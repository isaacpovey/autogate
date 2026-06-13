import { execFile } from 'node:child_process';

export type ExecResult = {
  stdout: string;
  stderr: string;
  code: number;
};

export type Exec = (args: { file: string; args: string[] }) => Promise<ExecResult>;

const maxBuffer = 64 * 1024 * 1024;

export const nodeExec: Exec = ({ file, args }) =>
  new Promise((resolve, reject) => {
    execFile(file, args, { maxBuffer, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error === null) {
        resolve({ stdout, stderr, code: 0 });
        return;
      }
      const code = typeof error.code === 'number' ? error.code : 1;
      if (code === 0) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr, code });
    });
  });
