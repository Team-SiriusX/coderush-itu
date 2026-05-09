import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { handle } from 'hono/vercel'
import base from './controllers/(base)/index'

const app = new Hono().basePath('/api')

app.route('/', base)

app.onError((err, c) => {
  console.log(err)

  if (err instanceof HTTPException) {
    return err.getResponse()
  }

  return c.json({ message: 'Internal Error' }, 500)
})

const routes = app

export const GET    = handle(app)
export const POST   = handle(app)
export const PUT    = handle(app)
export const PATCH  = handle(app)
export const DELETE = handle(app)

export type AppType = typeof routes
