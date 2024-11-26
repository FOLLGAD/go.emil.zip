import { Hono } from 'hono';
import { PostHog } from 'posthog-node';
import { getConnInfo } from 'hono/cloudflare-workers';

const app = new Hono<{
	Bindings: Env;
}>();

app.use(async (c, next) => {
	const posthog = new PostHog(c.env.POSTHOG_API_KEY, {
		host: c.env.POSTHOG_API_HOST,
	});
	const info = getConnInfo(c); // info is `ConnInfo`

	posthog.capture({
		distinctId: info.remote.address ?? 'unknown',
		event: 'pageview',
		properties: {
			path: c.req.path,
		},
	});

	await next();

	await posthog.flush();
});

app
	.get('/', async (c) => {
		const results = await c.env.SHORTENER_STORE.list({ prefix: 'public/' });
		const keys = results.keys.map((key) => key.name.split('/').pop()).filter((key): key is string => !!key);

		return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>go.emil.zip</title>
</head>
<body>
    <h1>🔗⚡️</h1>
    <ul>
    ${keys
			.map(
				(key) => `<li>
							<a href="/${key.replace('public/', '')}">${key.replace('public/', '')}</a>
						</li>`
			)
			.join('')}
    </ul>
</body>
</html>
`);
	})
	.get('/:id', async (c) => {
		const id = c.req.param('id');
		const url = await Promise.any([
			c.env.SHORTENER_STORE.get(id, {
				cacheTtl: 1000 * 60 * 60 * 24 * 7,
			}),
			c.env.SHORTENER_STORE.get('public/' + id, {
				cacheTtl: 1000 * 60 * 60 * 24 * 7,
			}),
		]);
		if (!url) {
			return c.notFound();
		}
		return c.redirect(url);
	})
	.post('/:id', async (c) => {
		const id = c.req.param('id');
		const { url, password, public: isPublic } = await c.req.json<{ url: string; password: string; public: boolean }>();

		if (!url) {
			return c.json({ error: 'Missing url' }, 400);
		}

		if (!password || password !== c.env.ADMIN_PASSWORD) {
			return c.json({ error: 'Invalid password' }, 401);
		}

		const id2 = (isPublic ? 'public/' : '') + id;
		await c.env.SHORTENER_STORE.put(id2, url);
		return c.json({ id, url });
	});

export default app;
