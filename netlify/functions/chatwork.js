// Netlify Function: Chatwork APIへの橋渡し（ブラウザからは直接呼べないためサーバー経由にする）
//
// 事前準備:
// 1. Netlifyの管理画面 → Site settings → Environment variables で
//    CHATWORK_API_TOKEN という名前でChatworkのAPIトークンを登録してください。
// 2. このファイルを netlify/functions/chatwork.js としてリポジトリに配置し、
//    HTMLファイルと一緒にデプロイしてください。
//
// フロントエンドからは /.netlify/functions/chatwork に POST します。
// body例: { "action": "members", "roomId": "123456789" }
//         { "action": "notify",  "roomId": "123456789", "message": "本文" }

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'POSTのみ対応しています' }) };
  }

  const token = process.env.CHATWORK_API_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: 'CHATWORK_API_TOKEN が設定されていません' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'リクエストの形式が正しくありません' }) };
  }

  const { action, roomId, message } = payload;
  if (!roomId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'roomIdが必要です' }) };
  }

  try {
    if (action === 'members') {
      const res = await fetch(`https://api.chatwork.com/v2/rooms/${roomId}/members`, {
        headers: { 'X-ChatWorkToken': token },
      });
      const data = await res.json();
      if (!res.ok) {
        return { statusCode: res.status, body: JSON.stringify({ error: data }) };
      }
      const members = (data || []).map((m) => ({ accountId: m.account_id, name: m.name }));
      return { statusCode: 200, body: JSON.stringify({ members }) };
    }

    if (action === 'notify') {
      if (!message) {
        return { statusCode: 400, body: JSON.stringify({ error: 'messageが必要です' }) };
      }
      const params = new URLSearchParams({ body: message, self_unread: '0' });
      const res = await fetch(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: {
          'X-ChatWorkToken': token,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const data = await res.json();
      if (!res.ok) {
        return { statusCode: res.status, body: JSON.stringify({ error: data }) };
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true, messageId: data.message_id }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: '不明なactionです' }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
