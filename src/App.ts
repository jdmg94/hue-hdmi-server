import Koa from "koa";
import Boom from "@hapi/boom";
import { koaBody } from "koa-body";
import KoaRouter from "@koa/router";
import Bonjour from "@homebridge/ciao";
import { Worker } from "worker_threads";
import { get, isEmpty } from "lodash-es";
import HueSync, { EntertainmentArea } from "hue-sync";

import chunk from "./utils/chunk";
import sleep from "./utils/sleep";
import { store } from "./state/store";
import { setBridge, setCredentials, setServerStatus } from "./state/reducer";
import { ServerStatus } from "./utils/status";
import {
  persistNewCredentials,
  getRegisteredCredentials,
} from "./utils/credentialHelpers";

type HueWebState = {
  isActive: boolean;
  bridge?: HueSync;
  entertainmentArea?: EntertainmentArea;
};

const { dispatch, subscribe, getState } = store;

const observe = (path: string | string[]) => {
  const isPathEmpty = isEmpty(path);
  let result = isPathEmpty ? getState() : get(getState(), path);

  subscribe(() => {
    result = isPathEmpty ? getState() : get(getState(), path);
  });

  return result;
};

export async function startWeb(tunnelUrl, port = 8080) {
  const app = new Koa();
  const router = new KoaRouter();
  const bridge = observe("bridge");
  const bonjour = Bonjour.getResponder();
  const controller = new AbortController();
  const worker = new Worker("./build/CVWorker");

  app.use(koaBody());
  app.use(router.routes());
  app.use(
    router.allowedMethods({
      throw: true,
      notImplemented: () => Boom.notImplemented(),
      methodNotAllowed: () => Boom.methodNotAllowed(),
    })
  );

  const broadcast = bonjour.createService({
    port,
    name: "Hue HDMI Sync",
    type: "hue-hdmi-sync",
    txt: {
      url: tunnelUrl,
    },
  });

  worker.on("message", (message) => {
    const colorData = chunk<number>(message, 3);
    if (bridge) {
      bridge.transition(colorData as Array<[number, number, number]>);
    } else {
      console.log("no bridge!");
    }
  });

  router.get("/check", (context) => {
    context.body = {
      status: observe("status"),
    };
  });

  router.get("/discovery", async (context) => {
    const devices = await HueSync.discover();

    context.body = devices;
  });

  router.post("/register", async (context) => {
    const ip = context.request.body.ip;
    const name = context.request.body.name || "hue-hdmi-sync";

    const nextCredentials = await HueSync.register(ip, name);

    dispatch(setCredentials(nextCredentials));

    context.body = {
      result: "OK",
      status: ServerStatus.NOT_READY,
    };
  });

  router.get("/entertainment-areas", async (context) => {
    if (!bridge) {
      const { output: notInitializedException } =
        Boom.preconditionFailed("Not Initialized!");

      context.status = notInitializedException.statusCode;
      context.body = {
        result: "ERROR",
        status: ServerStatus.ERROR,
        payload: notInitializedException.payload,
      };
    } else {
      const data = await bridge?.getEntertainmentAreas();

      context.body = data.map((item) => ({ id: item.id, name: item.name }));
    }
  });

  router.get("/stream/:id", async (context) => {
    if (!bridge) {
      const { output: notReadyException } = Boom.preconditionFailed(
        "Not Ready to Stream!"
      );

      context.status = notReadyException.statusCode;
      context.body = {
        status: "ERROR",
        payload: notReadyException.payload,
      };
    } else {
      const area = await bridge?.getEntertainmentArea(context.params.id);

      await bridge.start(area);
      worker.postMessage("start");

      dispatch(setServerStatus(ServerStatus.WORKING));

      context.body = {
        status: ServerStatus.WORKING,
      };
    }
  });

  router.get("/stop", async (context) => {
    const noSocketException = Boom.preconditionFailed("No Active Stream!");
    if (!bridge) {
      context.status = noSocketException.output.statusCode;
      context.body = noSocketException.output.payload;
      return;
    }

    try {
      worker.postMessage("stop");
      await sleep(500);
      bridge?.stop();

      dispatch(setServerStatus(ServerStatus.READY));

      context.body = {
        status: "ok",
      };
    } catch {
      context.status = noSocketException.output.statusCode;
      context.body = noSocketException.output.payload;
    }
  });

  router.put("/quick-start", async (context) => {
    const credentials = {
      clientkey: context.request.body.key,
      username: context.request.body.user,
    };

    dispatch(setCredentials(credentials));
    dispatch(setServerStatus(ServerStatus.READY));
    dispatch(
      setBridge(
        new HueSync({
          id: context.request.body.id,
          credentials,
          url: context.request.body.ip,
        })
      )
    );

    context.body = {
      status: ServerStatus.READY,
    };
  });

  broadcast.advertise();
  app.listen({
    host: "0.0.0.0",
    port,
    signal: controller.signal,
  });

  return () => {
    controller.abort();
    broadcast.end().then(() => {
      broadcast.destroy();
    });
  };
}
