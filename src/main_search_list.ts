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

function stringToNumber(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}


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
                limit: 25
            })
            lastResult = result.map((item: any) => item.obj)
        }

        lastResult.sort((a, b) => {
            return b.sort - a.sort
        })

        lastResult.sort((a, b) => {
            const rr = b.lastUseTime - a.lastUseTime
            return rr
        })

        lastResult = lastResult.slice(0, 25)

        return JSON.stringify(lastResult)
    } catch (err) {
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
    console.log('syncList', options)
    // 包含多个文件或者文件夹
    if (syncing) {
        return
    }

    syncing = true

    const { sync_applications, action, commandKey } = options

    try {
        // if (action === 'update') {
        //     //只更新某个命令的使用时间
        //     await syncCommand(commandKey)
        // } else {
        await syncAll(sync_applications)
        // }

        // get all applications on macos use shell
    } catch (err) {
        // 回退table
        //@ts-ignore
        throw err
    }

    syncing = false
}


const pathToNumber: Record<string, number> = {
    'chat_with_ai|chat': 100,
    'translate|ai': 99,
    'chat_with_doc|qa': 98,
    'internet_browsing|serpapi': 97,
    'tts|read_aloud': 96,
    'image_generation|image_generation': 95,
    'image_compress|tinypng': 94,
    'writing_package|explain': 93,
    'writing_package|emoji': 92,
    'writing_package|summarize': 91,
    'bot_emily|emily': 90,
    'screen_shot_action|screenshot': 89,
    'link_reader|summarize_webpage': 88,
    'translate|deepl': 87,
    'translate|google': 86,
    'ocr_action|silent_screenshot_ocr': 85,
    'ocr_action|screenshot_translate': 84,
    'tts|edge_tts': 83,
    'chat_with_ai|chat_gpt-4o-latest': 82,
    'chat_with_ai|chat_gpt-4o': 81,
    'chat_with_ai|chat_gpt-4-o-mini': 80,
    'chat_with_ai|chat_claude-3-opus': 79,
    'chat_with_ai|chat_claude-3.5-sonnet': 78,
    'chat_with_ai|chat_claude-3-haiku': 77,
    'chat_with_ai|gemini-1.5-pro-2m': 76,
    'chat_with_ai|gemini-1.5-pro-128k': 75,
    'chat_with_ai|gemini-1.5-flash-1m': 74,
    'chat_with_ai|gemini-1.5-flash-128k': 73,
    'chat_with_ai|o1-preview': 72,
    'chat_with_ai|o1-mini': 71,
};

function getNumberFromPath(path: string): number {
    for (const [key, value] of Object.entries(pathToNumber)) { if (path === key) { return value; } } return 0; // 如果没有找到匹配的路径，返回默认值 0 
}

async function syncAll(sync_applications: string) {

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
                id: uuidv4(),
                sort: getNumberFromPath(`${command.extensionName}|${command.name}`)
            }
        })

        const allApps = [...userApps, ...systemApps, ...coreSystemApps, ...allCommands]

        list = allApps

    } catch (err) {
        // 发生错误时捕获异常
        console.error(`execSync error: ${err}`);
    }
}

async function syncCommand(commadnKey: string) {
    list = list.map((item) => {
        if (item.path === commadnKey) {
            // unix 时间戳
            item.lastUseTime = new Date().getTime() / 1000
        }

        return item
    })
}
