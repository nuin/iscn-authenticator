// Local test service only. Never included in a production deployment.
const messages = [];
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/send') {
      messages.push(await request.json());
      return Response.json({ status: 'accepted', message_id: crypto.randomUUID() }, { status: 202 });
    }
    return Response.json(messages);
  },
};
