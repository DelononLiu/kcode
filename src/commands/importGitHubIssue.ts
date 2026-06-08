import * as vscode from 'vscode';
import * as net from 'net';
import * as tls from 'tls';
import { TaskStore } from '../store/TaskStore';
import { ConfigService } from '../core/ConfigService';
import { Task, TaskSource } from '../types';
import { log } from '../log';

interface GitHubIssueData {
    title: string;
    body: string;
    html_url: string;
}

interface ParsedUrl {
    owner: string;
    repo: string;
    issueNumber: number;
}

export function parseGitHubUrl(input: string): ParsedUrl | null {
    const fullUrlMatch = input.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)$/);
    if (fullUrlMatch) {
        return { owner: fullUrlMatch[1], repo: fullUrlMatch[2], issueNumber: parseInt(fullUrlMatch[3], 10) };
    }
    const shortMatch = input.match(/^([^/#]+)\/([^/#]+)#(\d+)$/);
    if (shortMatch) {
        return { owner: shortMatch[1], repo: shortMatch[2], issueNumber: parseInt(shortMatch[3], 10) };
    }
    return null;
}

function getProxy(): { host: string; port: number } | null {
    const env = process.env;
    const proxyUrl = env.ALL_PROXY || env.all_proxy || env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy;
    if (!proxyUrl) {
        log('import', 'No proxy configured in env vars');
        return null;
    }
    log('import', `Found proxy: ${proxyUrl}`);
    try {
        const u = new URL(proxyUrl);
        const port = parseInt(u.port, 10) || (u.protocol === 'socks5:' ? 1080 : 3128);
        return { host: u.hostname, port };
    } catch {
        const parts = proxyUrl.split(':');
        if (parts.length === 2) {
            return { host: parts[0], port: parseInt(parts[1], 10) };
        }
        return null;
    }
}

function socks5Connect(proxy: { host: string; port: number }, targetHost: string, targetPort: number): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
        const socket = net.connect(proxy.port, proxy.host);
        socket.setTimeout(10000);

        socket.on('connect', () => {
            const targetHostBytes = Buffer.from(targetHost, 'utf-8');
            if (targetHostBytes.length > 255) {
                reject(new Error('Target hostname too long'));
                return;
            }

            const buf = Buffer.concat([
                Buffer.from([0x05, 0x01, 0x00]),
            ]);
            socket.write(buf);
        });

        let state = 0;
        let bufs: Buffer[] = [];

        socket.on('data', (data: Buffer) => {
            bufs.push(data);
            const all = Buffer.concat(bufs);

            if (state === 0 && all.length >= 2) {
                if (all[0] !== 0x05 || all[1] !== 0x00) {
                    reject(new Error(`SOCKS5 handshake failed: version=${all[0]} auth=${all[1]}`));
                    return;
                }

                const targetHostBytes = Buffer.from(targetHost, 'utf-8');
                const req = Buffer.concat([
                    Buffer.from([0x05, 0x01, 0x00, 0x03, targetHostBytes.length]),
                    targetHostBytes,
                    Buffer.from([(targetPort >> 8) & 0xff, targetPort & 0xff]),
                ]);
                socket.write(req);
                state = 1;
                bufs = [];
            } else if (state === 1 && all.length >= 10) {
                if (all[0] !== 0x05 || all[1] !== 0x00) {
                    reject(new Error(`SOCKS5 connect failed: version=${all[0]} rep=${all[1]}`));
                    return;
                }
                socket.removeAllListeners('data');
                socket.setTimeout(0);
                resolve(socket);
            }
        });

        socket.on('error', reject);
        socket.on('timeout', () => {
            socket.destroy();
            reject(new Error('Connection timed out'));
        });
    });
}

function rawHttpsGet(host: string, path: string, headers: Record<string, string>): Promise<string> {
    return new Promise(async (resolve, reject) => {
        let socket: net.Socket;
        const proxy = getProxy();
        if (proxy) {
            try {
                socket = await socks5Connect(proxy, host, 443);
            } catch (err: any) {
                reject(new Error(`代理连接失败 (${proxy.host}:${proxy.port}): ${err.message}`));
                return;
            }
        } else {
            socket = net.connect(443, host);
        }

        (socket as any).once('connect', () => {
            const tlsSocket = tls.connect({ socket: socket as any, host, servername: host, rejectUnauthorized: true });
            tlsSocket.on('secureConnect', () => {
                const headerLines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
                tlsSocket.write(`GET ${path} HTTP/1.1\r\nHost: ${host}\r\n${headerLines}\r\nConnection: close\r\n\r\n`);

                let raw = '';
                tlsSocket.on('data', (chunk) => { raw += chunk.toString(); });
                tlsSocket.on('end', () => {
                    const match = raw.match(/^HTTP\/1\.[01] (\d+)/);
                    const statusCode = match ? parseInt(match[1], 10) : 0;
                    const headerEnd = raw.indexOf('\r\n\r\n');
                    const rawHeaders = headerEnd !== -1 ? raw.slice(0, headerEnd) : raw;
                    const isChunked = /transfer-encoding:\s*chunked/i.test(rawHeaders);
                    let body = '';
                    if (headerEnd !== -1) {
                        let rawBody = raw.slice(headerEnd + 4);
                        if (isChunked) {
                            let parsed = '';
                            let pos = 0;
                            while (pos < rawBody.length) {
                                const chunkEnd = rawBody.indexOf('\r\n', pos);
                                if (chunkEnd === -1) break;
                                const sizeStr = rawBody.slice(pos, chunkEnd).trim();
                                if (sizeStr === '') break;
                                const size = parseInt(sizeStr, 16);
                                if (size === 0) break;
                                parsed += rawBody.slice(chunkEnd + 2, chunkEnd + 2 + size);
                                pos = chunkEnd + 2 + size + 2;
                            }
                            body = parsed;
                        } else {
                            body = rawBody;
                        }
                    }

                    log('import', `GET https://${host}${path} -> ${statusCode} bodyLen=${body.length} bodyPreview=${JSON.stringify(body.slice(0, 200))}`);
                    if (statusCode === 404) {
                        reject(new Error('Issue 不存在 (404)'));
                    } else if (statusCode === 403) {
                        reject(new Error('API 请求被拒绝 (403)，请检查 token 是否有效'));
                    } else if (statusCode >= 400) {
                        reject(new Error(`GitHub API 请求失败: ${statusCode}`));
                    } else {
                        resolve(body);
                    }
                });
            });
            tlsSocket.on('error', (err) => reject(new Error(`TLS 连接失败: ${err.message}`)));
        });

        (socket as any).on('error', (err: Error) => reject(new Error(`网络连接失败: ${err.message}`)));
        (socket as any).on('timeout', () => {
            socket.destroy();
            reject(new Error('连接超时'));
        });
    });
}

async function fetchGitHubIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    token?: string
): Promise<GitHubIssueData> {
    const path = `/repos/${owner}/${repo}/issues/${issueNumber}`;
    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'kcode-vscode-extension',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    log('import', `Fetching: api.github.com${path} token=${token ? 'yes' : 'no'}`);

    const body = await rawHttpsGet('api.github.com', path, headers);
    const data = JSON.parse(body);
    return {
        title: data.title,
        body: data.body || '',
        html_url: data.html_url,
    };
}

export async function importGitHubIssue(
    store: TaskStore,
    openTask: (taskId: string, autoSendGoal?: string) => void,
    refreshSidebar: () => void
): Promise<void> {
    log('import', '--- importGitHubIssue started ---');
    const input = await vscode.window.showInputBox({
        prompt: 'GitHub Issue URL 或 owner/repo#123',
        placeHolder: 'https://github.com/owner/repo/issues/123 或 owner/repo#123',
        ignoreFocusOut: true,
    });
    if (!input) {
        log('import', 'User cancelled');
        return;
    }
    log('import', `Input: ${input}`);

    const parsed = parseGitHubUrl(input);
    if (!parsed) {
        const msg = '格式错误，请使用 GitHub Issue URL 或 owner/repo#123 格式';
        log('import', msg);
        vscode.window.showErrorMessage(msg);
        return;
    }
    log('import', `Parsed: ${parsed.owner}/${parsed.repo}#${parsed.issueNumber}`);

    const token = (ConfigService.getInstance().get<string>('github.token', '') || '').trim() || undefined;

    let issue: GitHubIssueData;
    try {
        issue = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: '正在导入 GitHub Issue...' },
            () => fetchGitHubIssue(parsed.owner, parsed.repo, parsed.issueNumber, token)
        );
    } catch (err: any) {
        const msg = err?.message ?? String(err) ?? '未知错误';
        log('import', `Error: ${msg}`);
        vscode.window.showErrorMessage(`导入失败: ${msg}`);
        return;
    }

    log('import', `Fetched: ${issue.title}`);
    log('import', `Body length: ${issue.body.length}`);
    log('import', `Body preview: ${JSON.stringify(issue.body.slice(0, 300))}`);

    const bodyPreview = issue.body.length > 500 ? issue.body.slice(0, 500) + '\n...' : issue.body;
    const confirmAction = await vscode.window.showInformationMessage(
        `确认导入 Issue`,
        {
            modal: true,
            detail: [
                `标题: ${issue.title}`,
                `来源: ${parsed.owner}/${parsed.repo}#${parsed.issueNumber}`,
                `链接: ${issue.html_url}`,
                ``,
                bodyPreview
            ].join('\n')
        },
        '确认导入',
        '取消'
    );
    if (confirmAction !== '确认导入') {
        log('import', 'User cancelled import confirmation');
        return;
    }

    const source: TaskSource = {
        type: 'github_issue',
        url: issue.html_url,
        owner: parsed.owner,
        repo: parsed.repo,
        issueNumber: parsed.issueNumber,
    };

    const task: Task = {
        id: `task_${Date.now()}`,
        title: `GH#${parsed.issueNumber}: ${issue.title}`,
        goal: issue.body,
        type: 'task',
        status: 'pending',
        phase: 'goal',
        confirmedItems: [],
        pendingItems: [],
        planSteps: [],
        originalRequest: issue.body || '',
        createdAt: Date.now(),
        workspace: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
        source,
    };
    store.addTask(task);
    log('import', `Task created: ${task.id}`);
    refreshSidebar();
    const initialMsg = `GH#${parsed.issueNumber}: ${issue.title}\n\n${issue.body}`;
    openTask(task.id, initialMsg);
}
