import { uuid as uuidv4, Command, List, environment, rg } from "@enconvo/api";
import { useEffect, useState } from "react";
import { exec } from 'child_process';
import fs from 'fs';
import { Action } from "@enconvo/api";
import { ListItem } from "@enconvo/api";
import { homedir } from "os";

export interface SearchResult {
    id: string;
    type?: 'app' | 'command';
    title: string;
    path: string;
    icon: string;
    lastUseTime?: number;
}

export default function App() {
    const [searchText, setSearchText] = useState("");
    const [searchPath, setSearchPath] = useState("");
    const [formats, setFormats] = useState("");
    const [items, setItems] = useState<SearchResult[]>([]);
    const [internalTimer, setInternalTimer] = useState<NodeJS.Timeout | undefined>(undefined);
    const [controller, setController] = useState<AbortController>(new AbortController());

    useEffect(() => {

        Command.getCommandOptions().then((options: any) => {

            if (!fs.existsSync(environment.supportPath)) {
                fs.mkdirSync(environment.supportPath);
            }

            // let searchPath = "/Users/ysnows"
            let searchPathOption = options.searchPath
            // 去掉不存在的路径
            searchPathOption = searchPathOption.split(',').map((path: string) => {
                // 替换 ~ 为用户目录，只替换开头的~
                if (path.startsWith("~")) {
                    return path.replace("~", homedir())
                }
                return path
            }).filter((path: string) => {
                return path && fs.existsSync(path as string)
            }).join(' ')

            setSearchPath(searchPathOption)

            let searchFormats = options.formats
            // 去掉不存在的路径
            searchFormats = searchFormats.split(',').map((format: string) => {
                if (format) {
                    return `--type-add '${format}:*.${format}'  --type ${format}`
                } else {
                    return ''
                }
            }).join(' ')

            setFormats(searchFormats)

        })
    }, []); // 依赖数组中包含 apps，当 apps 更新时，此 useEffect 将运行

    let isSearching = false

    const execSearch = (text: string) => {
        try {
            const re = `${rg.rgPath}  --max-count 1 --ignore-case ${formats} --json ${searchText} ${searchPath}`;
            controller.abort()
            const newController = new AbortController();
            setController(newController)
            const { signal } = newController;
            exec(re, { signal }, (error, stdout, stderr) => {

                if (error) {
                    isSearching = false
                    return
                }

                const lines = stdout.trim().split('\n');
                const contacts: SearchResult[] = []
                lines.forEach((line) => {
                    try {
                        const item: any = JSON.parse(line)
                        if (item.type !== "match") {
                            return
                        }

                        const text = item.data.path.text
                        // remove 换行符
                        const path = text.replace(/\n/g, "")
                        const title = path.split('/').pop() || ''

                        const resultItem = {
                            title: title,
                            path: path,
                            icon: '',
                            id: uuidv4()
                        };
                        contacts.push(resultItem)

                    } catch (error) {

                    }
                });
                isSearching = false
                setItems(contacts.slice(0, 10))

            });
        } catch (error) {
            isSearching = false
            console.error('An error occurred while executing the search:', error);
            throw error;
        }
    }

    // 创建防抖函数
    const debouncedSearch = (text: string) => {
        clearTimeout(internalTimer);
        if (controller) {
            controller.abort();
        }

        // 在这里执行搜索逻辑
        isSearching = true

        if (!searchText) {
            setItems([])
            isSearching = false
            return;
        }

        // 如果是空字符串或者都是空格，直接返回空数组
        if (searchText.trim() === "") {
            setItems([])
            isSearching = false
            return;
        }

        // 500毫秒内无新的输入则执行搜索,
        setAbortableTimeout(() => {
            execSearch(text)
        }, 50);

    } // 500毫秒内无新的输入则执行搜索

    useEffect(() => {
        debouncedSearch(searchText);
    }, [searchText]); // 依赖数组中包含 apps，当 apps 更新时，此 useEffect 将运行

    /**
        * I create a timer that can be canceled using the optional AbortSignal.
        */
    function setAbortableTimeout(callback: (args: void) => void, delayInMilliseconds?: number, { signal }: { signal?: AbortSignal } = { signal: undefined }) {

        // When the calling context triggers an abort, we need to listen to for it so
        // that we can turn around and clear the internal timer.
        // --
        // NOTE: We're creating a proxy callback to remove this event-listener once
        // the timer executes. This way, our event-handler never gets invoked if
        // there's nothing for it to actually do. Also note that the "abort" event
        // will only ever get emitted once, regardless of how many times the calling
        // context tries to invoke .abort() on its AbortController.

        const internalTimer = setTimeout(internalCallback, delayInMilliseconds);
        setInternalTimer(internalTimer)

        function internalCallback() {
            callback();
        }
    }

    return (
        <>
            <List onSearchTextChange={setSearchText} >
                {
                    items.map((item: SearchResult) => {
                        return <ListItem actions={[
                            Action.OpenFile({ path: item.path }),
                            Action.ChatWithFile({ path: item.path }),
                            Action.ShowInFinder({ path: item.path }),
                        ]} key={item.id} title={item.title} subTitle={item.path} icon={`fileicon:${item.path}`}></ListItem>
                    })
                }
            </List>
        </>
    );
}

