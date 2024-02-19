import Koa from "koa"
import Boom from "@hapi/boom"
import HueSync from "hue-sync"
import { koaBody } from "koa-body"
import KoaRouter from "@koa/router"
import { Worker } from "worker_threads"

import chunk from "./utils/chunk"
import sleep from "./utils/sleep"

enum ServerStatus {
  NOT_READY = "not ready",
  READY = "ready",
  IDLE = "idle",
  WORKING = "working",
  ERROR = "error",
}

const cache = new Map();
const getBridge = (): HueSync => {
  if (cache.has('bridge')) {
    return cache.get('bridge')
  }

  const id = cache.get('id')
  const url = cache.get('url')
  const clientkey = cache.get('key')
  const username = cache.get('username')

  const bridge = new HueSync({
    id,
    url,
    credentials: {
      clientkey,
      username
    }
  })

  cache.set('bridge', bridge)

  return bridge
}

export async function startWeb(port = 8000) {
  const app = new Koa()
  const router = new KoaRouter()
  const controller = new AbortController()
  const worker = new Worker("./build/CVWorker")

  cache.set("status", ServerStatus.NOT_READY)
  
  app.use(koaBody())
  app.use(router.routes())
  app.use(
    router.allowedMethods({
      throw: true,
      notImplemented: () => Boom.notImplemented(),
      methodNotAllowed: () => Boom.methodNotAllowed(),
    })
  )

  worker.on("message", (message) => {
    const bridge = getBridge()
    const colorData = chunk<number>(message, 3)

    bridge.transition(colorData as Array<[number, number, number]>)
  })

  router.get("/check", (context) => {
    const status = cache.get('status')

    context.body = {
      status,
    }
  })

  router.get("/discovery", async (context) => {
    const devices = await HueSync.discover()

    context.body = devices
  })

  router.post("/register", async (context) => {
    const { 
      ip, 
      name = "hue-hdmi-sync" 
    } = context.request.body
    const nextCredentials = await HueSync.register(ip, name)

    cache.set('key', nextCredentials.clientkey)
    cache.set('user', nextCredentials.username)

    context.body = {
      status: "ok",
    }
  })

  router.get("/entertainment-areas", async (context) => {
    try {
      const bridge = getBridge()
      const data = await bridge.getEntertainmentAreas()

      context.body = data.map((item) => ({ id: item.id, name: item.name }))
    } catch (err) {
      context.body = {
        error: err.message
      }
    }
  })

  router.get("/stream/:id", async (context) => {
    try {
      const bridge = getBridge()
      const area = await bridge.getEntertainmentArea(context.params.id)

      await bridge.start(area)
      worker.postMessage("start")

      cache.set('status', ServerStatus.WORKING)

      context.body = {
        status: ServerStatus.WORKING,
      };
    } catch {
      // do nothing
    }
  })

  router.get("/stop", async (context) => {
    const bridge = getBridge()
    const noSocketException = Boom.preconditionFailed("No Active Stream!");
    try {
      worker.postMessage("stop")
      await sleep(500)
      bridge.stop()
      cache.set('status', ServerStatus.IDLE)

      context.body = {
        status: "ok",
      }
    } catch {
      context.status = noSocketException.output.statusCode
      context.body = noSocketException.output.payload
    }
  })

  router.put("/quick-start", async (context) => {
    const {
      id, url, key, user,
    } = context.request.body

    cache.set('id', id)
    cache.set('url', url)
    cache.set('key', key)
    cache.set('username', user)
    cache.set('status', ServerStatus.READY)

    context.body = {
      status: ServerStatus.READY,
    }
  })

  app.listen({
    port,
    host: "0.0.0.0",
    signal: controller.signal,
  })

  console.log(`listening on port ${port}!`)

  return controller.abort 
}
