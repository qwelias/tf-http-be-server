import * as fs from 'node:fs'
import { createServer, IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import { createHash } from 'crypto'

/**@typedef {[v?: string | Readable | Buffer | null, status?: [code: number, message?: string], headers?: { [k: string]: string }]} ResTuple */

createServer((req, res) => {
    console.log(new Date().toISOString(), req.method, req.url)
    handler(req).then(
        ([v, status, headers]) => {
            status?.[0] && (res.statusCode = status?.[0])
            status?.[1] && (res.statusMessage = status?.[1])
            for (const [k, v] of Object.entries(headers || {})) res.setHeader(k, v)
            if (v instanceof Readable) v.pipe(res)
            else res.end(v)
        },
        (reason) => {
            res.statusCode = 500
            res.end(String(reason))
            console.error(new Date().toISOString(), reason)
        },
    )
    // @ts-ignore ts dumm again
}).listen(process.env.PORT || 3000, process.env.HOST || '0.0.0.0')

/**
 * @param {IncomingMessage} req
 * @returns {Promise<ResTuple>}
 */
const handler = async (req) => {
    const { url = '', method = '' } = req
    const { searchParams, pathname } = new URL(url, `http://${req.headers.host}`)

    if (!pathname.match(/^\/[\d\w_-]+$/)) return [, [400, 'Bad path']]

    if (method in actions)
        return actions[method](
            pathname,
            req,
            searchParams,
        )

    return [, [405]]
}

const state = './state'
const lockinfo = '/lockinfo.json'
const counter = '/counter'
const tfstate = '.terraform.tfstate'

/**@type{{[k:string]: (path: string, req: IncomingMessage, params: URLSearchParams) => ResTuple}} */
const actions = {
    LOCK: (path, req) => {
        fs.mkdirSync(state + path, { recursive: true })

        if (fs.existsSync(state + path + lockinfo)) return [fs.createReadStream(state + path + lockinfo), [409]]

        req.pipe(fs.createWriteStream(state + path + lockinfo))
        return []
    },
    UNLOCK: (path, req) => {
        const lock = createHash('md5').update(maybeRead(state + path + lockinfo) || '').digest('base64')
        const md5 = req.headers['content-md5']
        if (lock !== md5) return [, [409]]

        fs.rmSync(state + path + lockinfo)
        return []
    },
    GET: (path) => {
        const count = maybeReadNumber(state + path + counter)
        if (count == null) return [, [404]]
        return [fs.createReadStream(state + path + '/' + count + tfstate)]
    },
    POST: (path, req, params) => {
        fs.mkdirSync(state + path, { recursive: true })

        const ID = params.get('ID')
        const lock = maybeReadJson(state + path + lockinfo)
        if (!lock && ID) return [, [404]]
        if (lock && lock.ID !== ID) return [, [409]]

        const count = (maybeReadNumber(state + path + counter) || 0) + 1
        fs.writeFileSync(state + path + counter, String(count))
        req.pipe(fs.createWriteStream(state + path + '/' + count + tfstate))
        return []
    },
    DELETE: (path) => {
        const count = maybeReadNumber(state + path + counter)
        if (count == null) return [, [404]]
        if (maybeReadJson(state + path + lockinfo)) return [, [423]]

        fs.rmSync(state + path, { recursive: true, force: true })
        return []
    }
}

/**
 *
 * @param {string} path
 */
const maybeRead = (path) => {
    try {
        return String(fs.readFileSync(path))
    } catch (e) {
        // @ts-ignore
        if (e.code === 'ENOENT') return
        throw e
    }
}

/**
 *
 * @param {string} path
 */
const maybeReadNumber = (path) => {
    const str = maybeRead(path)
    return str == null ? str : Number(str)
}

/**
 *
 * @param {string} path
 */
const maybeReadJson = (path) => {
    const str = maybeRead(path)
    return str == null ? str : JSON.parse(str)
}
