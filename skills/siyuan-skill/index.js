/**
 * Siyuan Skill 技能主入口文件
 * 提供标准技能接口和单指令调用支持
 */

const path = require('path');

const VERSION = '1.7.8';
const ConfigManager = require('./config');
const SiyuanConnector = require('./connector');
const commands = require('./commands');
const NotebookManager = require('./lib/notebook-manager');
const DocumentManager = require('./lib/document-manager');
const SearchManager = require('./lib/search-manager');

/**
 * SiyuanNotesSkill 类
 * 提供完整的 Siyuan Notes 连接和管理功能
 */
class SiyuanNotesSkill {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.baseURL - Siyuan Notes API 地址
   * @param {string} options.token - API 令牌
   * @param {number} options.timeout - 请求超时时间（毫秒）
   */
  constructor(options = {}) {
    this.configManager = new ConfigManager({
      overrideConfig: options
    });
    const config = this.configManager.getConfig();

    this.connector = new SiyuanConnector(config);
    this.config = config;
    this.initialized = false;

    this.notebookManager = new NotebookManager(this.connector);
    this.documentManager = new DocumentManager(this.connector);
    this.searchManager = new SearchManager(this.connector);
  }

  /**
   * 获取所有笔记本（便捷方法）
   * @returns {Promise<Object>} 笔记本列表
   */
  async getNotebooks() {
    return this.notebookManager.getNotebooks();
  }

  /**
   * 初始化技能连接
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async init() {
    if (this.initialized) {
      return true;
    }

    try {
      const connected = await this.connector.testConnection();
      if (!connected) {
        throw new Error('无法连接到 Siyuan Notes');
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取技能信息
   * @returns {Object} 技能信息
   */
  getInfo() {
    return {
      name: 'siyuan-skill',
      version: VERSION,
      description: 'Siyuan Notes 连接器技能',
      commands: Object.keys(commands).map(cmd => ({
        name: cmd,
        description: commands[cmd].description || '无描述'
      }))
    };
  }

  /**
   * 执行单指令
   * @param {string} commandName - 指令名称
   * @param {Object} args - 指令参数
   * @returns {Promise<any>} 指令执行结果
   */
  async executeCommand(commandName, args = {}) {
    if (!this.initialized) {
      await this.init();
    }

    const command = commands[commandName];
    if (!command) {
      throw new Error(`未知指令：${commandName}`);
    }

    return command.execute(this, args);
  }

  /**
   * 获取所有可用指令
   * @returns {Array} 指令列表
   */
  getCommands() {
    return Object.keys(commands).map(name => ({
      name,
      description: commands[name].description || '',
      usage: commands[name].usage || ''
    }));
  }

  /**
   * 获取配置
   * @returns {Object} 当前配置
   */
  getConfig() {
    return this.config;
  }

  /**
   * 检查权限
   * @param {string} notebookId - 笔记本 ID
   * @returns {boolean} 是否有权限
   */
  checkPermission(notebookId) {
    const { permissionMode, notebookList } = this.config;

    if (permissionMode === 'all') {
      return true;
    }

    if (permissionMode === 'blacklist') {
      return !notebookList.includes(notebookId);
    }

    if (permissionMode === 'whitelist') {
      return notebookList.includes(notebookId);
    }

    return true;
  }
}

/**
 * 创建技能实例的工厂函数
 * @param {Object} options - 配置选项
 * @returns {SiyuanNotesSkill} 技能实例
 */
function createSkill(options = {}) {
  return new SiyuanNotesSkill(options);
}

/**
 * 单指令执行函数
 * @param {string} commandName - 指令名称
 * @param {Object} args - 指令参数
 * @param {Object} options - 技能配置选项
 * @returns {Promise<any>} 执行结果
 */
async function executeSingleCommand(commandName, args = {}, options = {}) {
  const skill = createSkill(options);
  await skill.init();
  return skill.executeCommand(commandName, args);
}

const getNotebooks = async (options = {}) => {
  return executeSingleCommand('get-notebooks', {}, options);
};

const getDocStructure = async (notebookId, options = {}) => {
  return executeSingleCommand('get-doc-structure', { notebookId }, options);
};

const getDocContent = async (docId, format = 'markdown', options = {}) => {
  return executeSingleCommand('get-doc-content', { docId, format }, options);
};

const searchContent = async (query, searchOptions = {}, skillOptions = {}) => {
  return executeSingleCommand('search-content', { query, ...searchOptions }, skillOptions);
};

const createDocument = async (parentId, title, content = '', options = {}) => {
  return executeSingleCommand('create-document', { parentId, title, content }, options);
};

const updateDocument = async (docId, content, options = {}) => {
  return executeSingleCommand('update-document', { docId, content }, options);
};

const deleteDocument = async (docId, options = {}) => {
  return executeSingleCommand('delete-document', { docId }, options);
};

const moveDocument = async (docId, targetParentId, moveOptions = {}, options = {}) => {
  return executeSingleCommand('move-document', { docId, targetParentId, ...moveOptions }, options);
};

const convertPath = async (params, options = {}) => {
  return executeSingleCommand('convert-path', params, options);
};

const pathToId = async (path, options = {}) => {
  return executeSingleCommand('convert-path', { path }, options);
};

const idToPath = async (id, options = {}) => {
  return executeSingleCommand('convert-path', { id }, options);
};

module.exports = {
  VERSION,
  SiyuanNotesSkill,
  createSkill,
  executeSingleCommand,
  commands,
  getNotebooks,
  getDocStructure,
  getDocContent,
  searchContent,
  createDocument,
  updateDocument,
  deleteDocument,
  moveDocument,
  convertPath,
  pathToId,
  idToPath
};
