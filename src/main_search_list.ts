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
        const limit = options.limit || 100

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
                limit: limit
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

        lastResult = lastResult.slice(0, limit)

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
        if (action === 'update') {
            //只更新某个命令的使用时间
            await syncCommand(commandKey)
        } else if (action === 'delete') {

            list = list.filter((item) => {
                return item.path !== commandKey
            })
        }
        else if (action === 'remove') {

            list = list.map((item) => {
                if (item.path === commandKey) {
                    // unix 时间戳
                    item.lastUseTime = 0
                }
                return item
            })
        }
        else {
            await syncAll(sync_applications)
        }

        // get all applications on macos use shell
    } catch (err) {
        // 回退table
        //@ts-ignore
        throw err
    }

    syncing = false
}




function getNumberFromPath(path: string): number {
    const index = defaultCommandList.indexOf(path);
    if (index !== -1) {
        // 我们返回 (100 - index) 来保持原始的数字顺序，
        // 因为在原始 Record 中，较高的数字对应较早的索引
        return 100 - index;
    }
    return 0

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


const defaultCommandList: string[] = [
    'chat_with_ai|chat',
    'internet_browsing|serpapi',
    'chat_with_doc|qa',
    'voice_input|voice_input_method',
    'voice_input|voice_input',
    'link_reader|chat_with_link',
    'translate|ai',
    'tts|read_aloud',
    'chat_with_ai|local_chat_ollama',
    'screen_shot_action|screenshot',
    'image_generation|image_generation',
    'writing_package|explain',
    'image_compress|tinypng',
    'prompt_generator|prompt_generator_openai',
    'writing_package|summarize',
    'bot_emily|emily',
    'calender|add_event_to_apple_calender',
    'writing_package|fix-spelling-and-grammar',
    'writing_package|emoji',
    'link_reader|summarize_webpage',
    'ocr_action|screenshot_translate',
    'link_reader|link_read_aloud',
    'ocr_action|silent_screenshot_ocr',
    'calender|add_event_to_apple_reminder',
    'translate|deepl',
    'translate|google',
    'tts|edge_tts',
    'bot_spanish_teacher|spanish_teacher',
    'bot_latin_teacher|latin_teacher',
    'chat_with_ai|chat_gpt-4o-latest',
    'chat_with_ai|chat_gpt-4o',
    'chat_with_ai|chat_gpt-4-o-mini',
    'chat_with_ai|chat_claude-3-opus',
    'chat_with_ai|chat_claude-3.5-sonnet',
    'chat_with_ai|chat_claude-3-haiku',
    'chat_with_ai|gemini-1.5-pro-2m',
    'chat_with_ai|gemini-1.5-pro-128k',
    'chat_with_ai|gemini-1.5-flash-1m',
    'chat_with_ai|gemini-1.5-flash-128k',
    'chat_with_ai|o1-preview',
    'chat_with_ai|o1-mini',
    'writing_package|make-longer',
    'writing_package|make-shorter',
    'writing_package|change_tone_to_friendly',
    'writing_package|change_tone_to_casual'
];