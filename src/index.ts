import { Hono } from 'hono';

const app = new Hono<{
	Bindings: Env;
}>();

app
	.get('/', (c) => c.text('Welcome to go.emil.zip!'))
	.get('/:id', async (c) => {
		const id = c.req.param('id');
		const url = await c.env.SHORTENER_STORE.get(id, {
			cacheTtl: 1000 * 60 * 60 * 24 * 7,
		});
		if (!url) {
			return c.notFound();
		}
		return c.redirect(url);
	})
	.post('/:id', async (c) => {
		const id = c.req.param('id');
		const { url, password } = await c.req.json<{ url: string; password: string }>();

		if (!url) {
			return c.json({ error: 'Missing url' }, 400);
		}

		if (!password || password !== c.env.ADMIN_PASSWORD) {
			return c.json({ error: 'Invalid password' }, 401);
		}

		await c.env.SHORTENER_STORE.put(id, url);
		return c.json({ id, url });
	});

export default app;
