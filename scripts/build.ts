const outdir = 'dist';

await Bun.$`rm -rf ${outdir}`;

const app = await Bun.build({
  entrypoints: ['./src/index.html'],
  outdir,
  minify: true,
});

const worker = await Bun.build({
  entrypoints: ['./src/sw.ts'],
  outdir,
  minify: true,
});

for (const build of [app, worker]) {
  if (!build.success) {
    for (const log of build.logs) {
      console.error(log);
    }

    process.exit(1);
  }
}

for (const icon of ['icon-192.png', 'icon-512.png']) {
  await Bun.write(`${outdir}/${icon}`, Bun.file(`src/${icon}`));
}

for (const output of [...app.outputs, ...worker.outputs]) {
  const kb = (output.size / 1024).toFixed(2);
  console.log(`  ${output.path.replace(`${process.cwd()}/`, '')}  ${kb} KB`);
}
