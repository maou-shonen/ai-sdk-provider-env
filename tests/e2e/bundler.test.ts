import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const PROJECT_ROOT = resolve(import.meta.dirname, '../..')
const DIST_INDEX = join(PROJECT_ROOT, 'dist/index.mjs')

describe('bundler e2e', () => {
  let buildDir: string
  let isolatedDir: string

  beforeAll(async () => {
    // Build dist/ so we test the real published output (with __require)
    const build = Bun.spawn(['bun', 'run', 'build'], {
      cwd: PROJECT_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    await build.exited
    if (build.exitCode !== 0) {
      const stderr = await new Response(build.stderr).text()
      throw new Error(`bun run build failed:\n${stderr}`)
    }

    // Build dir: has node_modules symlink so bun can resolve @ai-sdk/* during compile
    buildDir = await mkdtemp(join(tmpdir(), 'ai-sdk-provider-env-e2e-'))
    await symlink(join(PROJECT_ROOT, 'node_modules'), join(buildDir, 'node_modules'))

    // Isolated dir: no node_modules — used to run compiled binaries
    isolatedDir = await mkdtemp(join(tmpdir(), 'ai-sdk-provider-env-isolated-'))
  })

  afterAll(async () => {
    await rm(buildDir, { recursive: true, force: true })
    await rm(isolatedDir, { recursive: true, force: true })
  })

  it('bun build --compile with factories should produce a working binary', async () => {
    const fixturePath = join(buildDir, 'test-factories.ts')
    const outPath = join(isolatedDir, 'test-factories')

    // Fixture imports from dist/ (real published output with __require).
    // The user's static `import { createOpenAI }` is what makes it bundler-safe.
    await Bun.write(fixturePath, `
      import { createOpenAI } from '@ai-sdk/openai'
      import { envProvider } from '${DIST_INDEX}'

      process.env.OPENAI_API_KEY = 'test-key-e2e'

      const provider = envProvider({
        factories: { openai: createOpenAI },
      })
      const model = provider.languageModel('openai/gpt-4o')
      console.log('E2E_SUCCESS:' + model.modelId)
    `)

    // Compile to a self-contained binary
    const build = Bun.spawn(
      ['bun', 'build', fixturePath, '--compile', '--outfile', outPath],
      { cwd: buildDir, stdout: 'pipe', stderr: 'pipe' },
    )
    await build.exited
    const buildStderr = await new Response(build.stderr).text()
    expect(build.exitCode, `bun build --compile failed:\n${buildStderr}`).toBe(0)

    // Run from isolated dir — no node_modules available
    const run = Bun.spawn([outPath], {
      cwd: isolatedDir,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const stdout = await new Response(run.stdout).text()
    const stderr = await new Response(run.stderr).text()
    await run.exited

    expect(run.exitCode, `Binary execution failed:\n${stderr}`).toBe(0)
    expect(stdout).toContain('E2E_SUCCESS:gpt-4o')
  })

  it('bun build --compile without factories should fail at runtime', async () => {
    const fixturePath = join(buildDir, 'test-no-factories.ts')
    const outPath = join(isolatedDir, 'test-no-factories')

    // Import from dist/ — __require("@ai-sdk/openai") is opaque to bun,
    // so the package won't be bundled into the compiled binary.
    await Bun.write(fixturePath, `
      import { envProvider } from '${DIST_INDEX}'

      process.env.OPENAI_API_KEY = 'test-key-e2e'

      try {
        const provider = envProvider()
        const model = provider.languageModel('openai/gpt-4o')
        console.log('UNEXPECTED_SUCCESS:' + model.modelId)
      } catch (e) {
        console.log('E2E_EXPECTED_FAIL:' + (e as Error).message)
      }
    `)

    // Compile succeeds — __require is just preserved as-is
    const build = Bun.spawn(
      ['bun', 'build', fixturePath, '--compile', '--outfile', outPath],
      { cwd: buildDir, stdout: 'pipe', stderr: 'pipe' },
    )
    await build.exited
    expect(build.exitCode).toBe(0)

    // Run from isolated dir — __require can't find @ai-sdk/openai
    const run = Bun.spawn([outPath], {
      cwd: isolatedDir,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const stdout = await new Response(run.stdout).text()
    await run.exited

    expect(stdout).toContain('E2E_EXPECTED_FAIL:')
    expect(stdout).toContain('Could not load @ai-sdk/openai')
    expect(stdout).not.toContain('UNEXPECTED_SUCCESS')
  })
})
