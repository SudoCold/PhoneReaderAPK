// Install build prerequisites only inside this project; no system configuration changes.
import { mkdir, writeFile, access, readdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const tools = path.join(root, '.tools');
await mkdir(tools, { recursive: true });
async function download(url, file) {
  try { await access(file); console.log(`Using ${path.basename(file)}`); return; } catch {}
  console.log(`Downloading ${path.basename(file)}…`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
}
function unzip(zip, dest) {
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${zip.replaceAll("'", "''")}', '${dest.replaceAll("'", "''")}')`], { stdio: 'inherit' });
}
const jdkAssets = await (await fetch('https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse')).json();
const jdkPackage = jdkAssets[0].binary.package;
await download(jdkPackage.link, path.join(tools, 'jdk.zip'));
await mkdir(path.join(tools, 'java'), { recursive: true });
if (!(await readdir(path.join(tools, 'java'))).length) unzip(path.join(tools, 'jdk.zip'), path.join(tools, 'java'));
const javaHome = path.join(tools, 'java', (await readdir(path.join(tools, 'java'))).find(name => name.startsWith('jdk')));
console.log(`JDK ready: ${javaHome}`);
const xml = await (await fetch('https://dl.google.com/android/repository/repository2-1.xml')).text();
const packages = [...xml.matchAll(/<remotePackage path="cmdline-tools;([^"]+)"[\s\S]*?<\/remotePackage>/g)].filter(match => match[1] === '19.0');
packages.sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
const windows = [...packages[0][0].matchAll(/<archive>[\s\S]*?<\/archive>/g)].find(match => match[0].includes('<host-os>windows</host-os>'))[0];
const archiveUrl = windows.match(/<url>(.*?)<\/url>/)[1];
await download(`https://dl.google.com/android/repository/${archiveUrl}`, path.join(tools, 'commandline-19.zip'));
const sdk = path.join(tools, 'android-sdk');
const commandTools = path.join(sdk, 'cmdline-tools', 'legacy');
await mkdir(commandTools, { recursive: true });
try { await access(path.join(commandTools, 'cmdline-tools', 'bin', 'sdkmanager.bat')); } catch { unzip(path.join(tools, 'commandline-19.zip'), commandTools); }
await writeFile(path.join(tools, 'android-env.json'), JSON.stringify({ javaHome, sdk }, null, 2));
console.log('Android command-line tools ready.');
