// Builds the demo and publishes dist/ to the gh-pages branch, which GitHub Pages serves.
// Usage: npm run deploy:pages
import { execSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'

const run = (cmd, cwd) => execSync(cmd, { stdio: 'inherit', cwd })
const remote = execSync('git remote get-url origin').toString().trim()
const source = execSync('git rev-parse --short HEAD').toString().trim()

run('npm run build')
writeFileSync('dist/.nojekyll', '')
rmSync('dist/.git', { recursive: true, force: true })
run('git init -q -b gh-pages', 'dist')
run('git add -A', 'dist')
run(`git commit -q -m "Deploy demo from ${source}"`, 'dist')
run(`git push -f ${remote} gh-pages`, 'dist')
rmSync('dist/.git', { recursive: true, force: true })
console.log('\nPublished. GitHub Pages updates in about a minute.')
