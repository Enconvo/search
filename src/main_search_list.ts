import path from "path";
import * as fs from 'fs';
import { uuid as uuidv4, Command, Commander } from "@enconvo/api";
import { SearchResult } from "./search_files.tsx";
import fuzzysort from 'fuzzysort'


/**
 * 
 * {
    "name": "sync_applications",
    "title": "applications",
    "description": "Chat with WebPage Link",
    "mode": "no-view",
    "preferences": [
      {
        "name": "embedding",
        "description": "The model used to generate embedding",
        "type": "extension",
        "required": false,
        "default": "default",
        "title": "Embedding Model"
      }
    ]
  },
 */

let list: SearchResult[] = []



export default async function main(req: Request) {
    // let table;
    try {
        const { options } = await req.json()
        const { text: searchText, search_application } = options

        if (list.length <= 0) {

            Commander.addClickListener(handleSyncListRequest, 'sync_applications')
            await syncList(options)
        }

        let lastResult: SearchResult[] = []

        if (!searchText) {
            if (!search_application) {
                lastResult = list.filter((item) => {
                    return item.type !== 'app'
                })
            } else {
                lastResult = list
            }

            lastResult.sort((a, b) => {
                const rr = b.lastUseTime - a.lastUseTime
                return rr
            })
            lastResult = lastResult.slice(0, 10)
        } else {
            if (!search_application) {
                lastResult = list.filter((item) => {
                    return item.type !== 'app'
                })
            } else {
                lastResult = list
            }

            const result = fuzzysort.go(searchText, lastResult, {
                key: 'title',
                limit: 10
            })
            lastResult = result.map((item: any) => item.obj)
            lastResult.sort((a, b) => {
                return b.lastUseTime - a.lastUseTime
            })
        }
        // 让b.name === 'chat' 的排在最前面
        lastResult.sort((a, b) => {
            if (a.path === 'chat_with_ai|chat') {
                return -1
            }
            if (b.path === 'chat_with_ai|chat') {
                return 1
            }
            return 0
        })

        return JSON.stringify(lastResult)
    } catch (err) {
        console.log(err)
    }
}


export const handleSyncListRequest = async (req: Request): Promise<any> => {
    const options = await req.json()

    return await syncList(options)
}


function collectApps(dir: string): any[] {
    let apps: SearchResult[] = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (path.extname(file) === '.bundle') {
            continue
        }

        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (path.extname(file) === '.app') {
            const name = path.basename(file, '.app');
            apps.push({
                type: 'app',
                title: name,
                path: fullPath,
                icon: '',
                lastUseTime: 0,
                id: uuidv4()
            });
        } else if (stat.isDirectory()) {
            apps = apps.concat(collectApps(fullPath));
        }
    }
    return apps;
}

let syncing = false

export const syncList = async (options: any): Promise<any> => {
    // 包含多个文件或者文件夹
    if (syncing) {
        return
    }

    syncing = true

    const { sync_applications } = options

    try {
        // get all applications on macos use shell

        try {
            // shell 命令用于列出 /Applications 目录下所有条目的路径

            let userApps: SearchResult[] = []
            let systemApps: SearchResult[] = []
            let coreSystemApps: SearchResult[] = []

            if (sync_applications === "true") {
                userApps = collectApps('/Applications');
                systemApps = collectApps('/System/Applications');
                coreSystemApps = collectApps('/System/Library/CoreServices');
            }

            const commands = await Command.getAllExecutableCommands()
            const allCommands: SearchResult[] = commands.map((command) => {
                return {
                    type: 'command',
                    title: command.title,
                    path: `${command.extensionName}|${command.name}`,
                    icon: command.icon || '',
                    lastUseTime: parseInt(command.lastUseTime) || 0,
                    id: uuidv4()
                }
            })

            const allApps = [...userApps, ...systemApps, ...coreSystemApps, ...allCommands]

            list = allApps

        } catch (err) {
            // 发生错误时捕获异常
            console.error(`execSync error: ${err}`);
        }
    } catch (err) {
        // 回退table
        //@ts-ignore
        throw err
    }

    syncing = false
}
