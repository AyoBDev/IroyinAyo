const db = require('../../config/database');
const { NotFoundError } = require('../../utils/errors');

async function create({ title, body, source, source_url, is_broadcast, categories, is_approved, scheduled_at }) {
  const content = await db.transaction(async (trx) => {
    const [c] = await trx('content')
      .insert({
        title,
        body,
        source: source || 'manual',
        source_url,
        is_broadcast: is_broadcast || false,
        is_approved: is_approved !== undefined ? is_approved : true,
        scheduled_at,
      })
      .returning('*');

    if (categories && categories.length > 0) {
      const rows = categories.map((category) => ({
        content_id: c.id,
        category,
      }));
      await trx('content_tags').insert(rows);
    }

    return c;
  });

  return getById(content.id);
}

async function getById(id) {
  const content = await db('content').where({ id }).first();
  if (!content) throw new NotFoundError('Content not found');

  const tags = await db('content_tags')
    .where({ content_id: id })
    .select('category');

  return { ...content, categories: tags.map((t) => t.category) };
}

async function getFeedForStudent(studentId) {
  const interests = await db('student_interests')
    .where({ student_id: studentId })
    .select('category');
  const categories = interests.map((i) => i.category);

  const broadcastContent = await db('content')
    .where({ is_broadcast: true, is_published: true, is_approved: true })
    .orderBy('published_at', 'desc')
    .limit(10);

  let personalizedContent = [];
  if (categories.length > 0) {
    personalizedContent = await db('content')
      .join('content_tags', 'content.id', 'content_tags.content_id')
      .whereIn('content_tags.category', categories)
      .andWhere({ 'content.is_published': true, 'content.is_approved': true, 'content.is_broadcast': false })
      .select('content.*')
      .groupBy('content.id')
      .orderBy('content.published_at', 'desc')
      .limit(10);
  }

  const allContent = [...broadcastContent, ...personalizedContent];
  allContent.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

  const withTags = await Promise.all(allContent.map((c) => getById(c.id)));
  return withTags;
}

async function publish(id) {
  const content = await db('content').where({ id }).first();
  if (!content) throw new NotFoundError('Content not found');

  await db('content').where({ id }).update({
    is_published: true,
    published_at: new Date(),
  });

  return getById(id);
}

async function listPendingApproval() {
  const items = await db('content')
    .where({ is_approved: false })
    .orderBy('created_at', 'desc');

  return Promise.all(items.map((c) => getById(c.id)));
}

async function approve(id) {
  const content = await db('content').where({ id }).first();
  if (!content) throw new NotFoundError('Content not found');

  await db('content').where({ id }).update({ is_approved: true });
  return getById(id);
}

async function listAll({ page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const items = await db('content')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  const countResult = await db('content').count('id as count').first();
  const total = parseInt(countResult.count, 10);

  const contentWithTags = await Promise.all(
    items.map(async (item) => {
      const tags = await db('content_tags').where({ content_id: item.id }).select('category');
      return { ...item, categories: tags.map((t) => t.category) };
    })
  );

  return { content: contentWithTags, total, page, limit };
}

module.exports = { create, getById, getFeedForStudent, publish, listPendingApproval, approve, listAll };
