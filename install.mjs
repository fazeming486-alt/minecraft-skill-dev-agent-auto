#!/usr/bin/env node
/**
 * Install the Minecraft dev skill pack into a skill directory.
 *
 * Default target: ~/.qoder/skills (Qoder user-level skills).
 * Other agents: pass --target <their-skills-dir> and set MCDEV_HOME to
 * <target>/_minecraft-dev for the scaffold/gradle CLI.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKILLS_SRC = path.join(HERE, 'skills')
const RUNTIME_SRC = path.join(HERE, 'runtime')
const RUNTIME_NAME = '_minecraft-dev'

function usage() {
  console.log(`Usage: node install.mjs [--target <skills-dir>] [--force] [--list]

  --target <dir>  Skill directory to install into (default: ~/.qoder/skills)
  --force         Overwrite existing skill folders
  --list          Print what would be installed, then exit
  --help          Show this help

Installs each skills/<name>/ folder and the shared runtime as <target>/${RUNTIME_NAME}.
The runtime provides:
  node "<target>/${RUNTIME_NAME}/mcdev.mjs" platforms
  node "<target>/${RUNTIME_NAME}/mcdev.mjs" scaffold --platform forge --mc 1.20.1 ...
  node "<target>/${RUNTIME_NAME}/mcdev.mjs" gradle --dir <project> --task build
`)
}

function parseArgs(argv) {
  const out = { force: false, list: false, target: path.join(os.homedir(), '.qoder', 'skills') }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--force') out.force = true
    else if (token === '--list') out.list = true
    else if (token === '--help' || token === '-h') out.help = true
    else if (token === '--target') {
      const value = argv[i + 1]
      if (!value) throw new Error('--target needs a value')
      out.target = path.resolve(value)
      i += 1
    } else {
      throw new Error(`unknown argument: ${token}`)
    }
  }
  return out
}

function listSkills() {
  if (!fs.existsSync(SKILLS_SRC)) throw new Error(`missing skills directory: ${SKILLS_SRC}`)
  return fs.readdirSync(SKILLS_SRC, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(SKILLS_SRC, entry.name, 'SKILL.md')))
    .map(entry => entry.name)
    .sort()
}

function copyDir(src, dest, force) {
  const existed = fs.existsSync(dest)
  if (existed && !force) {
    console.log(`skip    ${dest} (exists; use --force to overwrite)`)
    return false
  }
  if (existed && force) fs.rmSync(dest, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(src, dest, { recursive: true })
  console.log(`install ${dest}`)
  return true
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    usage()
    return
  }
  if (!fs.existsSync(RUNTIME_SRC)) throw new Error(`missing runtime directory: ${RUNTIME_SRC}`)
  const skills = listSkills()
  console.log(`target: ${args.target}`)
  console.log(`skills: ${skills.join(', ')}`)
  console.log(`runtime: ${RUNTIME_NAME}`)
  if (args.list) return

  let installed = 0
  for (const name of skills) {
    if (copyDir(path.join(SKILLS_SRC, name), path.join(args.target, name), args.force)) installed += 1
  }
  if (copyDir(RUNTIME_SRC, path.join(args.target, RUNTIME_NAME), args.force)) installed += 1

  console.log(`\nInstalled ${installed} folder(s). Restart your agent or reload skills.`)
  if (path.resolve(args.target) !== path.join(os.homedir(), '.qoder', 'skills')) {
    console.log(`Runtime override for non-default installs:`)
    console.log(`  export MCDEV_HOME="${path.join(args.target, RUNTIME_NAME)}"`)
    console.log(`  node "$MCDEV_HOME/mcdev.mjs" platforms`)
  } else {
    console.log(`Runtime CLI: node "${path.join(args.target, RUNTIME_NAME, 'mcdev.mjs')}" platforms`)
  }
}

try {
  main()
} catch (error) {
  console.error(`install: ${error?.message ?? error}`)
  process.exit(1)
}
