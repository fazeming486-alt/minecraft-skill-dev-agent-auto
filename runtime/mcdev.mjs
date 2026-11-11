#!/usr/bin/env node
/**
 * mcdev — Qoder-side port of the minecraft-dev scaffold/gradle tools.
 *
 * Adapted from sikadi233-hub/minecraft-dev (Apache-2.0). The original DSH
 * plugin registered `mc_scaffold` / `mc_gradle` on the harness tool bus; this
 * CLI exposes the same engines to any agent that can run a shell.
 *
 * Usage:
 *   node mcdev.mjs platforms
 *   node mcdev.mjs scaffold --platform forge --mc 1.20.1 \
 *     --dir /path/to/new-project --name my-mod --package com.example.mymod [--java 17]
 *   node mcdev.mjs gradle --dir /path/to/project --task build \
 *     [--arg --offline]... [--timeout-ms 600000] [--tail-chars 12000]
 *
 * Exit code: 0 when the action ran (gradle's own exitCode is printed in the
 * result, mirroring the DSH tool), 1 on argument/spawn errors.
 */

import process from 'node:process'
import path from 'node:path'
import { scaffoldProject } from './lib/scaffold.js'
import { renderGradleResult, runGradle } from './lib/gradle.js'
import { PLATFORM_LINES, SUPPORTED_PLATFORMS } from './lib/versions.js'

function fail(message) {
  console.error(`mcdev: ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const out = { _: [], arg: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      out._.push(token)
      continue
    }
    const key = token.slice(2)
    if (key === 'arg') {
      const value = argv[i + 1]
      if (value === undefined) fail('--arg needs a value')
      out.arg.push(value)
      i += 1
      continue
    }
    if (key === 'json' || key === 'help') {
      out[key] = true
      continue
    }
    const value = argv[i + 1]
    // --task may legitimately start with "--" (e.g. --task --version, --task --stop).
    if (value === undefined || (value.startsWith('--') && key !== 'task')) fail(`--${key} needs a value`)
    out[key] = value
    i += 1
  }
  return out
}

function usage() {
  console.log(`mcdev — Minecraft project scaffold / Gradle runner (Qoder port)

Commands:
  platforms
      List supported platform lines and pinned versions.

  scaffold --platform <p> --mc <version> --dir <targetDir> --name <kebab-name>
           --package <java.package> [--java <n>]
      Create a complete Gradle project (build scripts, main class, metadata,
      Gradle wrapper) in a new or empty directory.

  gradle --dir <projectDir> --task <task> [--arg <extra>]... [--timeout-ms <n>]
         [--tail-chars <n>]
      Run the project's own gradlew. Prints exitCode/timedOut plus capped output.

Toolkit: ~/.qoder/skills/_minecraft-dev/
Upstream: https://github.com/sikadi233-hub/minecraft-dev (Apache-2.0)
`)
}

function cmdPlatforms() {
  for (const platform of SUPPORTED_PLATFORMS) {
    console.log(`\n[${platform}]`)
    for (const entry of PLATFORM_LINES[platform]) {
      console.log(`  mc ${entry.line.padEnd(5)} default=${entry.defaultMcVersion.padEnd(9)} java=${entry.javaVersion} template=${entry.templateDir}`)
    }
  }
}

async function cmdScaffold(args) {
  const platform = args.platform
  const minecraftVersion = args.mc ?? args['minecraft-version']
  const targetDir = args.dir ?? args['target-dir']
  const name = args.name
  const packageName = args.package ?? args['package-name']
  if (!platform || !minecraftVersion || !targetDir || !name || !packageName) {
    fail('scaffold requires --platform --mc --dir --name --package (see `mcdev.mjs help`)')
  }
  const javaVersion = args.java === undefined ? undefined : Number(args.java)
  const result = await scaffoldProject({
    platform,
    minecraftVersion,
    targetDir: path.resolve(targetDir),
    name,
    packageName,
    javaVersion,
  })
  if (args.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  console.log(`scaffold ok: platform=${result.platform} mc=${result.minecraftVersion} java=${javaVersion ?? 'era-default'}`)
  console.log(`dir=${result.projectDir}`)
  console.log(`files=${result.filesCreated.length} wrapper=${result.wrapperReady}`)
  console.log(`build: cd "${result.projectDir}" && ${result.buildCommand}`)
}

async function cmdGradle(args) {
  const projectDir = args.dir
  const task = args.task
  if (!projectDir || !task) fail('gradle requires --dir and --task')
  const timeoutMs = args['timeout-ms'] === undefined ? 600_000 : Number(args['timeout-ms'])
  const tailChars = args['tail-chars'] === undefined ? 12_000 : Number(args['tail-chars'])
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) fail('--timeout-ms must be a positive number')
  if (!Number.isFinite(tailChars) || tailChars <= 0) fail('--tail-chars must be a positive number')

  const result = await runGradle({
    projectDir: path.resolve(projectDir),
    task,
    args: args.arg,
    timeoutMs,
    tailChars,
  })

  if (args.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  console.log(`gradle dir=${path.resolve(projectDir)} task=${task}`)
  console.log(`exitCode=${result.exitCode} timedOut=${result.timedOut} aborted=${result.aborted} timeoutMs=${result.timeoutMs}`)
  console.log('--- output ---')
  console.log(renderGradleResult(result))
}

const argv = process.argv.slice(2)
const command = argv[0]
const args = parseArgs(argv.slice(1))

if (!command || command === 'help' || args.help) {
  usage()
  process.exit(0)
}

try {
  if (command === 'platforms') cmdPlatforms()
  else if (command === 'scaffold') await cmdScaffold(args)
  else if (command === 'gradle') await cmdGradle(args)
  else fail(`unknown command ${command}; expected platforms|scaffold|gradle|help`)
} catch (error) {
  console.error(`mcdev: ${error?.message ?? error}`)
  process.exit(1)
}
