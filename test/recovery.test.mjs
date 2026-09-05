import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const storeModule = resolve(import.meta.dir, "../skills/poteto-mode/scripts/orch/store.ts");

test("saved reports recover an interrupted coordinator with the unchanged upstream store", () => {
  const directory = mkdtempSync(join(tmpdir(), "pstack-recovery-"));
  const prelude = `
    import { openStore } from ${JSON.stringify(storeModule)};
    import { writeFile, readFile, mkdir } from 'node:fs/promises';
    import { join } from 'node:path';
    const root = ${JSON.stringify(directory)};
    const store = openStore(root);
  `;
  try {
    const interrupted = Bun.spawnSync([process.execPath, "-e", prelude + `
      await store.init();
      await mkdir(join(root, 'briefs'));
      await mkdir(join(root, 'reports'));
      const report = join(root, 'reports/task-1.md');
      const brief = join(root, 'briefs/task-1.md');
      await writeFile(brief, 'Apply once; verify effect.txt contains applied; result: ' + report);
      await store.units.add({ id: 'task', track: 'proof', brief });
      await store.units.set({ id: 'task', state: 'running' });
      await store.gates.park({ id: 'publish', question: 'Publish?', options: 'yes/no', defaultAnswer: 'no' });
      await writeFile(join(root, 'effect.txt'), 'applied', { flag: 'wx' });
      await writeFile(report, 'Completed. effect.txt contains applied.');
      await store.inbox.push({ agent: 'worker', unit: 'task', status: 'done', report });
      await store.inbox.drain();
      process.exit(73);
    `]);
    expect(interrupted.exitCode).toBe(73);
    const before = statSync(join(directory, "effect.txt")).mtimeMs;
    const resumed = Bun.spawnSync([process.execPath, "-e", prelude + `
      const unit = await store.units.get('task');
      if (unit.state !== 'running') throw new Error('not the interruption window');
      if ((await store.inbox.peek()).length !== 0) throw new Error('notification was not drained');
      const brief = await readFile(unit.brief, 'utf8');
      const report = brief.split('result: ')[1];
      if (!report || !(await readFile(report, 'utf8')).includes('Completed')) throw new Error('missing report');
      if (await readFile(join(root, 'effect.txt'), 'utf8') !== 'applied') throw new Error('actual effect differs');
      if ((await store.gates.list())[0]?.id !== 'publish') throw new Error('human gate lost');
      await store.units.set({ id: 'task', state: 'done' });
      await store.close();
      console.log('accepted existing effect; pending human gate preserved');
    `]);
    expect(resumed.stderr.toString()).toBe("");
    expect(resumed.exitCode).toBe(0);
    expect(resumed.stdout.toString()).toContain("accepted existing effect");
    expect(readFileSync(join(directory, "effect.txt"), "utf8")).toBe("applied");
    expect(statSync(join(directory, "effect.txt")).mtimeMs).toBe(before);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
