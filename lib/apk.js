(()=>{
  'use strict';

  const P = POSIX;
  const UI = () => window.POSIXProgress;

  const fail = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
  };

  const bar = (loaded, total) => {
    const width = 24;
    if (!total) {
      const pos = Math.floor((loaded / 65536) % width);
      return '[' + '.'.repeat(pos) + '>' + '.'.repeat(Math.max(0, width - pos - 1)) + '] ' + P.fmt(loaded);
    }
    const percent = Math.min(100, Math.floor((loaded / total) * 100));
    const done = Math.floor((percent * width) / 100);
    return '[' + '#'.repeat(done) + '-'.repeat(width - done) + '] ' + String(percent).padStart(3) + '% ' + P.fmt(loaded) + '/' + P.fmt(total);
  };

  function progress(out, label, phase = 'Downloading') {
    let last = -1;
    return (loaded, total) => {
      const tick = total ? Math.floor((loaded / total) * 100) : Math.floor(loaded / 65536);
      if (tick === last) return;
      last = tick;
      out(label + ' ' + bar(loaded, total));
      if (total) UI()?.show(phase + ' ' + label, P.fmt(loaded) + ' / ' + P.fmt(total), tick);
      else UI()?.indeterminate(phase + ' ' + label, P.fmt(loaded) + ' downloaded');
    };
  }

  function oct(bytes, offset, length) {
    let s = '';
    for (let i = 0; i < length && bytes[offset + i]; i++) s += String.fromCharCode(bytes[offset + i]);
    return parseInt(s.trim() || '0', 8) || 0;
  }

  function str(bytes, offset, length) {
    let end = offset;
    while (end < offset + length && bytes[end]) end++;
    return new TextDecoder().decode(bytes.slice(offset, end));
  }

  async function gunzip(bytes, label, legacy = false) {
    if (typeof DecompressionStream === 'undefined') throw fail('EUNSUPPORTED', 'this browser does not support gzip DecompressionStream');
    if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) throw fail('EEXTRACT', 'package is not a gzip stream');
    UI()?.show('Extracting ' + label, legacy ? 'Reading legacy Alpine APK gzip stream' : 'Decompressing package', 5);
    let buffer;
    try {
      buffer = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    } catch (error) {
      throw fail('EEXTRACT', 'gzip decompression failed: ' + error.message);
    }
    const result = new Uint8Array(buffer);
    if (!result.length) throw fail('EEXTRACT', 'package decompressed to an empty archive');
    UI()?.set(70, 'Decompressed ' + P.fmt(result.length));
    return result;
  }

  async function untar(bytes, label) {
    const files = [];
    let offset = 0;
    let last = -1;
    let badHeaders = 0;
    UI()?.set(72, 'Reading tar archive');

    while (offset + 512 <= bytes.length) {
      let allZero = true;
      for (let i = 0; i < 512; i++) if (bytes[offset + i]) { allZero = false; break; }
      if (allZero) { offset += 512; continue; }

      let name = str(bytes, offset, 100);
      const size = oct(bytes, offset + 124, 12);
      const type = String.fromCharCode(bytes[offset + 156] || 48);
      const prefix = str(bytes, offset + 345, 155);
      const link = str(bytes, offset + 157, 100);
      if (prefix) name = prefix + '/' + name;
      name = name.replace(/^\.\//, '').replace(/^\//, '');

      if (!name) {
        badHeaders++;
        offset += 512;
        if (badHeaders > 8) throw fail('EARCHIVE', 'invalid tar headers while extracting ' + label);
        continue;
      }

      const end = offset + 512 + size;
      if (end > bytes.length) throw fail('EARCHIVE', 'truncated tar entry ' + name + ' (' + size + ' bytes expected)');
      const data = bytes.slice(offset + 512, end);
      if (!name.startsWith('.SIGN.') && name !== '.PKGINFO') files.push({ name, type, link, data });
      offset += 512 + Math.ceil(size / 512) * 512;

      const percent = 72 + Math.floor(Math.min(1, offset / bytes.length) * 18);
      if (percent !== last) {
        last = percent;
        UI()?.set(percent, 'Extracting ' + files.length + ' files');
      }
      if (files.length && files.length % 50 === 0) await new Promise(r => setTimeout(r, 0));
    }

    if (!files.length) throw fail('EARCHIVE', 'archive contained no installable files; this browser may only have decoded the APK signature member');
    UI()?.set(90, 'Archive ready · ' + files.length + ' entries');
    return files;
  }

  async function catalog() {
    let text;
    try {
      const response = await P.netFetch('/alpine/packages.tsv?build=' + encodeURIComponent(window.POSIX_BUILD || Date.now()));
      text = await response.text();
    } catch (error) {
      throw fail('ENET', 'could not load package catalog: ' + error.message);
    }
    if (!text.trim()) throw fail('ECATALOG', 'package catalog is empty');
    P.net.bytes += text.length;
    const map = new Map();
    for (const line of text.trim().split('\n')) {
      const [p, v, repo, file] = line.split('\t');
      if (p && v && repo && file) map.set(p, { p, v, repo, file });
    }
    if (!map.size) throw fail('ECATALOG', 'package catalog is invalid');
    return map;
  }

  async function downloadPackage(pkg, packageName, out) {
    const base = '/alpine/' + pkg.repo + '/riscv64/';
    const original = pkg.file;
    const normalized = original.endsWith('.apk') ? original.replace(/\.apk$/, '.browser.tar.gz') : original;

    if (normalized !== original) {
      UI()?.show('Checking package mirror', 'Looking for browser-normalized ' + packageName, 0);
      try {
        const d = await P.download(base + normalized, progress(out, packageName, 'Downloading'));
        return { bytes: d.bytes, file: normalized };
      } catch (error) {
        if (!/HTTP 404\b/.test(error.message)) throw fail('EDOWNLOAD', 'failed to download normalized ' + packageName + ': ' + error.message);
        out('apk: normalized package not present; trying Alpine APK compatibility mode');
      }
    }

    try {
      const d = await P.download(base + original, progress(out, packageName, 'Downloading'));
      return { bytes: d.bytes, file: original };
    } catch (error) {
      throw fail('EDOWNLOAD', 'failed to download ' + packageName + ': ' + error.message);
    }
  }

  async function install(packageName, out) {
    if (!packageName || !/^[A-Za-z0-9+_.-]+$/.test(packageName)) throw fail('EINVAL', 'invalid package name: ' + String(packageName || ''));
    if (P.packages.has(packageName)) {
      const version = P.packages.get(packageName)?.v || 'unknown';
      throw fail('EALREADY', packageName + '-' + version + ' is already installed');
    }

    const catalogMap = await catalog();
    const pkg = catalogMap.get(packageName);
    if (!pkg) throw fail('ENOENT', packageName + ' was not found in the browser package mirror');

    out('fetch ' + packageName + '-' + pkg.v);
    const downloaded = await downloadPackage(pkg, packageName, out);
    if (!downloaded.bytes?.length) throw fail('EDOWNLOAD', 'downloaded package is empty');

    const legacy = downloaded.file.endsWith('.apk');
    const payload = await gunzip(downloaded.bytes, packageName, legacy);
    const files = await untar(payload, packageName);

    out('extracting ' + packageName + ' · ' + files.length + ' entries');
    UI()?.show('Installing ' + packageName, '0 / ' + files.length + ' entries', 91);
    let installed = 0;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const path = '/' + f.name.replace(/\/$/, '');
      try {
        if (f.name && path !== '/') {
          if (f.type === '5') P.md(path);
          else if (f.type === '2') {
            P.md(path.split('/').slice(0, -1).join('/') || '/');
            P.fs.set(P.norm(path), { t: 'l', target: f.link, time: Date.now() });
          } else if (f.type === '0' || f.type === '\0' || f.type === '7') {
            P.write(path, f.data, true);
          }
          installed++;
        }
      } catch (error) {
        throw fail('EINSTALL', 'failed writing ' + path + ': ' + error.message);
      }
      if (i % 20 === 0 || i === files.length - 1) {
        const percent = 91 + Math.floor(((i + 1) / Math.max(1, files.length)) * 7);
        UI()?.set(percent, 'Installed ' + installed + ' / ' + files.length + ' entries');
        if (i % 80 === 0) await new Promise(r => setTimeout(r, 0));
      }
    }

    if (!installed) throw fail('EINSTALL', 'no files were installed from ' + packageName);
    UI()?.set(99, 'Saving package database');
    P.packages.set(packageName, { v: pkg.v, repo: pkg.repo, files: installed, time: Date.now() });
    try {
      await P.save();
    } catch (error) {
      P.packages.delete(packageName);
      throw fail('EDB', 'package files were extracted but package database save failed: ' + error.message);
    }
    UI()?.done(packageName + '-' + pkg.v + ' installed');
    out('OK: ' + packageName + '-' + pkg.v + ' installed (' + installed + ' entries)');
  }

  P.apk = async (args, out) => {
    const a = [...args];
    const command = a.shift() || 'help';
    try {
      if (command === 'help') return out('apk: update | add <pkg...> | search <query> | list --installed | info <pkg> | arch');
      if (command === 'arch') {
        if (a.length) throw fail('EINVAL', 'apk arch takes no arguments');
        return out('riscv64');
      }
      if (command === 'update') {
        if (a.length) throw fail('EINVAL', 'apk update takes no arguments');
        const errors = [];
        for (const repo of ['main', 'community']) {
          try {
            out('fetch ' + repo + '/APKINDEX');
            const d = await P.download('/alpine/' + repo + '/riscv64/APKINDEX.tar.gz', progress(out, repo, 'Updating index'));
            if (!d.bytes.length) throw fail('EINDEX', repo + ' index is empty');
            P.write('/var/cache/apk/' + repo + '.tar.gz', d.bytes, true);
            UI()?.done(repo + ' index updated');
            out('OK ' + repo + ' · ' + P.fmt(d.bytes.length));
          } catch (error) {
            errors.push(repo + ': ' + error.message);
            out('ERROR ' + repo + ': ' + error.message);
          }
        }
        try { await P.save(); } catch (error) { throw fail('EDB', 'could not save package indexes: ' + error.message); }
        if (errors.length) throw fail('EUPDATE', errors.length + ' repository update(s) failed');
        return;
      }
      if (command === 'add') {
        if (!a.length) throw fail('EINVAL', 'apk add requires at least one package name');
        const seen = new Set();
        for (const packageName of a) {
          if (seen.has(packageName)) throw fail('EINVAL', 'duplicate package argument: ' + packageName);
          seen.add(packageName);
          await install(packageName, out);
        }
        return;
      }
      if (command === 'list') {
        if (a.length !== 1 || a[0] !== '--installed') throw fail('EINVAL', 'usage: apk list --installed');
        if (!P.packages.size) return out('No packages installed.');
        for (const [name, info] of [...P.packages].sort()) out(name + '-' + info.v);
        return;
      }
      if (command === 'search') {
        if (a.length !== 1) throw fail('EINVAL', 'usage: apk search <query>');
        const query = a[0].toLowerCase();
        const catalogMap = await catalog();
        let count = 0;
        for (const [name, info] of catalogMap) if (name.toLowerCase().includes(query)) { out(name + '-' + info.v); count++; }
        if (!count) throw fail('ENOENT', 'no packages match: ' + a[0]);
        return;
      }
      if (command === 'info') {
        if (a.length !== 1) throw fail('EINVAL', 'usage: apk info <package>');
        const info = P.packages.get(a[0]);
        if (!info) throw fail('ENOENT', a[0] + ' is not installed');
        return out(a[0] + '-' + info.v + '\nrepository: ' + info.repo + '\nfiles: ' + (info.files ?? 'unknown'));
      }
      throw fail('ECOMMAND', 'unknown apk command: ' + command);
    } catch (error) {
      const text = (error.code ? '[' + error.code + '] ' : '') + error.message;
      UI()?.fail('apk: ' + text);
      throw new Error(text);
    }
  };
})();
