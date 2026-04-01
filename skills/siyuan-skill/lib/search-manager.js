/**
 * 搜索管理器
 * 提供内容搜索相关的核心功能
 * 支持 SQL 搜索
 */

/**
 * SearchManager 类
 * 管理搜索功能
 */
class SearchManager {
  /**
   * 构造函数
   * @param {Object} connector - Siyuan 连接器实例
   */
  constructor(connector) {
    this.connector = connector;
  }

  /**
   * 转义 SQL 字符串，防止 SQL 注入
   * @param {string} value - 需要转义的值
   * @returns {string} 转义后的值
   */
  escapeSql(value) {
    if (value === null || value === undefined) {
      return '';
    }
    const strValue = String(value);
    return strValue
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\0/g, '\\0')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\x1a/g, '\\Z');
  }

  /**
   * 验证并清理 ID 格式（思源笔记 ID 为 14-22 位字母数字）
   * @param {string} id - 需要验证的 ID
   * @returns {string|null} 清理后的 ID 或 null
   */
  validateId(id) {
    if (!id || typeof id !== 'string') {
      return null;
    }
    const cleaned = id.trim();
    if (!/^[a-zA-Z0-9_-]{14,32}$/.test(cleaned)) {
      return null;
    }
    return cleaned;
  }

  /**
   * 验证类型参数
   * @param {string} type - 需要验证的类型
   * @returns {string|null} 验证后的类型或 null
   */
  validateType(type) {
    if (!type || typeof type !== 'string') {
      return null;
    }
    const allowedTypes = ['d', 's', 'h', 'p', 'm', 't', 'html', 'video', 'audio', 'widget', 'iframe'];
    const cleaned = type.trim().toLowerCase();
    return allowedTypes.includes(cleaned) ? cleaned : null;
  }

  /**
   * 验证 limit 参数
   * @param {number} limit - 限制值
   * @param {number} defaultLimit - 默认值
   * @returns {number} 有效的限制值
   */
  validateLimit(limit, defaultLimit = 20) {
    if (typeof limit !== 'number' || isNaN(limit) || limit <= 0) {
      return defaultLimit;
    }
    return Math.min(Math.floor(limit), 100);
  }

  /**
   * 验证搜索查询
   * @param {string} query - 搜索查询
   * @returns {string} 清理后的查询
   */
  validateQuery(query) {
    if (!query || typeof query !== 'string') {
      return '';
    }
    return query.trim().substring(0, 1000);
  }

  /**
   * 搜索内容（SQL 搜索）
   * @param {string} query - 搜索查询
   * @param {Object} [options={}] - 搜索选项
   * @param {string} [options.notebookId] - 笔记本ID
   * @param {string} [options.path] - 搜索路径
   * @param {string} [options.parentId] - 父文档ID
   * @param {number} [options.limit=20] - 结果限制
   * @param {string} [options.sortBy='relevance'] - 排序方式
   * @param {string} [options.type] - 按单个类型过滤
   * @param {Array} [options.types] - 按多个类型过滤
   * @param {boolean} [options.hasTags] - 是否有标签
   * @param {string} [options.sql] - 自定义WHERE条件（通过 --where 参数传入）
   * @returns {Promise<Object>} 搜索结果
   */
  async searchContent(query, options = {}) {
    const {
      notebookId,
      path,
      parentId,
      limit = 20,
      sortBy = 'relevance',
      checkPermissionFn,
      type,
      types,
      hasTags,
      sql
    } = options;

    let results = [];

    try {
      const escapedQuery = this.escapeSql(query);
      let sqlQuery = `SELECT id, content, type, path, updated, box, parent_id, root_id FROM blocks WHERE content LIKE '%${escapedQuery}%'`;

      if (notebookId) {
        const validNotebookId = this.validateId(notebookId);
        if (validNotebookId) {
          sqlQuery += ` AND box = '${validNotebookId}'`;
        }
      }

      if (parentId) {
        const validParentId = this.validateId(parentId);
        if (validParentId) {
          sqlQuery += ` AND (path LIKE '/${validParentId}/%' OR root_id = '${validParentId}')`;
        }
      }

      if (type) {
        const validType = this.validateType(type);
        if (validType) {
          sqlQuery += ` AND type = '${validType}'`;
        }
      }

      if (types && Array.isArray(types) && types.length > 0) {
        const validTypes = types
          .map(t => this.validateType(t))
          .filter(t => t !== null);
        if (validTypes.length > 0) {
          sqlQuery += ` AND type IN ('${validTypes.join("','")}')`;
        }
      }

      if (sql && typeof sql === 'string') {
        const sanitizedSql = sql
          .replace(/--/g, '')
          .replace(/;/g, '')
          .replace(/\/\*/g, '')
          .replace(/\*\//g, '');
        sqlQuery += ` AND ${sanitizedSql}`;
      }

      const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
      sqlQuery += ` LIMIT ${safeLimit}`;

      const sqlResults = await this.connector.request('/api/query/sql', { stmt: sqlQuery });
      results = sqlResults || [];
    } catch (error) {
      console.error('SQL查询失败:', error.message);
      results = [];
    }

    let filteredResults = results;
    if (checkPermissionFn && typeof checkPermissionFn === 'function') {
      filteredResults = results.filter(result => {
        return !result.box || checkPermissionFn(result.box);
      });
    }

    let finalResults = filteredResults;
    if (hasTags !== undefined) {
      finalResults = finalResults.filter(result => {
        const tags = this.extractTags(result.content || '');
        return hasTags ? tags.length > 0 : tags.length === 0;
      });
    }

    const processedResults = this.processSearchResults(finalResults, query, sortBy);

    return {
      query,
      mode: 'legacy',
      notebookId,
      path,
      parentId,
      type,
      types,
      hasTags,
      sql,
      results: processedResults,
      total: processedResults.length,
      limit,
      sortBy
    };
  }

  /**
   * 处理搜索结果
   * @param {Array} results - 原始搜索结果
   * @param {string} query - 搜索查询
   * @param {string} sortBy - 排序方式
   * @returns {Array} 处理后的结果
   */
  processSearchResults(results, query, sortBy) {
    if (!results || !Array.isArray(results)) {
      return [];
    }

    const processedResults = results.map(result => {
      const content = result.content || '';
      const tags = this.extractTags(content);
      const relevanceScore = this.calculateRelevanceScore(content, query, tags);

      return {
        id: result.id,
        content,
        type: result.type || 'block',
        path: result.path || '',
        updated: result.updated || Date.now(),
        box: result.box || '',
        parent_id: result.parent_id || '',
        root_id: result.root_id || '',
        tags,
        relevanceScore,
        excerpt: content.substring(0, 200) + (content.length > 200 ? '...' : '')
      };
    });

    return processedResults.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.updated) - new Date(a.updated);
      }
      return b.relevanceScore - a.relevanceScore;
    });
  }

  /**
   * 从内容中提取标签
   * @param {string} content - 内容文本
   * @returns {Array} 标签数组
   */
  extractTags(content) {
    const tagRegex = /#([^\s#]+)/g;
    const tags = [];
    let match;
    while ((match = tagRegex.exec(content)) !== null) {
      tags.push(match[1]);
    }
    return tags;
  }

  /**
   * 计算相关性分数（归一化到 0-1 范围）
   * @param {string} content - 内容文本
   * @param {string} query - 搜索查询
   * @param {Array} tags - 标签数组
   * @returns {number} 相关性分数 (0-1)
   */
  calculateRelevanceScore(content, query, tags) {
    if (!content || !query) {
      return 0;
    }

    let score = 0;
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();

    if (contentLower.includes(queryLower)) {
      score += 0.4;
    }

    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    const matchedWords = queryWords.filter(word => contentLower.includes(word));
    if (queryWords.length > 0) {
      score += 0.3 * (matchedWords.length / queryWords.length);
    }

    const contentLengthBonus = Math.min(content.length / 5000, 0.1);
    score += contentLengthBonus;

    const tagBonus = Math.min(tags.length * 0.02, 0.1);
    score += tagBonus;

    if (content.startsWith('#')) {
      const headingMatch = content.match(/^#{1,6}/);
      if (headingMatch) {
        const headingLevel = headingMatch[0].length;
        score += (7 - headingLevel) * 0.02;
      }
    }

    return Math.min(Math.max(score, 0), 1);
  }
}

module.exports = SearchManager;
