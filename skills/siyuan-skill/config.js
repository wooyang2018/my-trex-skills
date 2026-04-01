/**
 * 配置管理器
 * 管理 Siyuan Skill 技能的配置
 */

const fs = require('fs');
const path = require('path');

/**
 * ConfigManager 类
 * 处理配置的加载、验证和保存
 */
class ConfigManager {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.configPath - 配置文件路径
   * @param {Object} options.overrideConfig - 覆盖配置
   */
  constructor(options = {}) {
    this.configPath = options.configPath || path.join(__dirname, 'config.json');
    this.defaultConfig = this.getDefaultConfig();
    this.overrideConfig = options.overrideConfig || {};
    this.config = this.loadConfig();
  }
  
  /**
   * 获取默认配置
   * @returns {Object} 默认配置
   */
  getDefaultConfig() {
    return {
      // 连接配置
      baseURL: 'http://localhost:6806',
      token: '',
      timeout: 10000,
      
      // 默认值
      defaultNotebook: null,
      
      // 权限配置
      permissionMode: 'all', // all, blacklist, whitelist
      notebookList: [],
      
      // 删除保护配置
      deleteProtection: {
        safeMode: true,
        requireConfirmation: false
      },
      
      // TLS 安全配置
      tls: {
          allowSelfSignedCerts: false,
          allowedHosts: ['localhost']
        }
    };
  }
  
  /**
   * 加载配置
   * @returns {Object} 合并后的配置
   */
  loadConfig() {
    // 从环境变量加载配置
    const envConfig = this.loadFromEnv();
    
    // 从配置文件加载配置
    const fileConfig = this.loadFromFile();
    
    // 简单合并配置，确保嵌套对象被正确覆盖
    const mergedConfig = {
      ...this.defaultConfig,
      ...fileConfig,
      ...envConfig,
      ...this.overrideConfig,
      deleteProtection: {
        ...this.defaultConfig.deleteProtection,
        ...fileConfig.deleteProtection,
        ...envConfig.deleteProtection,
        ...(this.overrideConfig.deleteProtection || {})
      },
      tls: {
        ...this.defaultConfig.tls,
        ...fileConfig.tls,
        ...envConfig.tls,
        ...(this.overrideConfig.tls || {})
      }
    };
    
    // 验证并返回配置
    return this.validateConfig(mergedConfig);
  }

  /**
   * 深度合并配置对象
   */
  deepMergeConfigs(...configs) {
    return configs.reduce((target, source) => {
      if (typeof target !== 'object' || target === null) {
        return source;
      }
      
      if (typeof source !== 'object' || source === null) {
        return source;
      }
      
      const merged = { ...target };
      
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && 
            !Array.isArray(source[key]) && 
            target[key] && typeof target[key] === 'object' && 
            !Array.isArray(target[key])) {
          // 深度合并嵌套对象
          merged[key] = this.deepMergeConfigs(target[key], source[key]);
        } else {
          // 简单值或数组直接覆盖
          merged[key] = source[key];
        }
      }
      
      return merged;
    }, {});
  }
  
  /**
   * 从环境变量加载配置
   * @returns {Object} 环境变量配置
   */
  loadFromEnv() {
    const envConfig = {};
    
    // 基础配置
    if (process.env.SIYUAN_BASE_URL) envConfig.baseURL = process.env.SIYUAN_BASE_URL;
    if (process.env.SIYUAN_TOKEN) envConfig.token = process.env.SIYUAN_TOKEN;
    if (process.env.SIYUAN_TIMEOUT) envConfig.timeout = parseInt(process.env.SIYUAN_TIMEOUT, 10);
    
    // 默认值
    if (process.env.SIYUAN_DEFAULT_NOTEBOOK) envConfig.defaultNotebook = process.env.SIYUAN_DEFAULT_NOTEBOOK;
    
    // 权限配置
    if (process.env.SIYUAN_PERMISSION_MODE) envConfig.permissionMode = process.env.SIYUAN_PERMISSION_MODE;
    if (process.env.SIYUAN_NOTEBOOK_LIST) {
      try {
        let notebookListStr = process.env.SIYUAN_NOTEBOOK_LIST.trim();
        // 处理 PowerShell 转义问题，修复单引号导致的解析失败
        if (notebookListStr.startsWith("'") && notebookListStr.endsWith("'")) {
          notebookListStr = notebookListStr.slice(1, -1);
        }
        // 替换可能存在的转义字符
        notebookListStr = notebookListStr.replace(/''/g, "'").replace(/\\"/g, '"');
        
        // 增强容错性：处理没有引号的数组元素
        if (notebookListStr.startsWith('[') && notebookListStr.endsWith(']')) {
          // 移除 [] 并处理元素
          const innerContent = notebookListStr.slice(1, -1).trim();
          if (innerContent) {
            // 检查是否是有效的JSON数组，不是则尝试修复
            try {
              envConfig.notebookList = JSON.parse(notebookListStr);
            } catch (jsonError) {
              const fixedStr = '["' + innerContent.replace(/["']/g, '').split(/\s*,\s*/).join('","') + '"]';
              envConfig.notebookList = JSON.parse(fixedStr);
            }
          } else {
            envConfig.notebookList = [];
          }
        } else if (notebookListStr.includes(',')) {
          envConfig.notebookList = notebookListStr.split(',').map(id => id.trim().replace(/['"]/g, '')).filter(id => id);
        } else {
          envConfig.notebookList = [notebookListStr.replace(/['"]/g, '')];
        }
      } catch (error) {
        envConfig.notebookList = [];
      }
    }
    
    // 删除保护配置
    if (process.env.SIYUAN_DELETE_SAFE_MODE !== undefined || 
        process.env.SIYUAN_DELETE_REQUIRE_CONFIRMATION !== undefined) {
      envConfig.deleteProtection = {
        safeMode: process.env.SIYUAN_DELETE_SAFE_MODE !== 'false',
        requireConfirmation: process.env.SIYUAN_DELETE_REQUIRE_CONFIRMATION === 'true'
      };
    }
    
    // TLS 安全配置
    if (process.env.SIYUAN_TLS_ALLOW_SELF_SIGNED !== undefined) {
      envConfig.tls = {
        allowSelfSignedCerts: process.env.SIYUAN_TLS_ALLOW_SELF_SIGNED === 'true',
        allowedHosts: process.env.SIYUAN_TLS_ALLOWED_HOSTS 
          ? process.env.SIYUAN_TLS_ALLOWED_HOSTS.split(',').map(h => h.trim())
          : this.defaultConfig.tls.allowedHosts
      };
    }
    
    return envConfig;
  }
  
  /**
   * 从文件加载配置
   * @returns {Object} 文件配置
   */
  loadFromFile() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.warn('配置文件加载失败:', error.message);
    }
    
    return {};
  }
  
  /**
   * 验证配置
   * @param {Object} config - 要验证的配置
   * @returns {Object} 验证后的配置
   */
  validateConfig(config) {
    const validatedConfig = { ...config };
    
    // 验证连接配置
    if (typeof validatedConfig.baseURL !== 'string' || !validatedConfig.baseURL) {
      validatedConfig.baseURL = this.defaultConfig.baseURL;
    }
    
    if (typeof validatedConfig.token !== 'string') {
      validatedConfig.token = this.defaultConfig.token;
    }
    
    if (typeof validatedConfig.timeout !== 'number' || validatedConfig.timeout <= 0) {
      validatedConfig.timeout = this.defaultConfig.timeout;
    }
    
    // 验证权限配置
    if (typeof validatedConfig.permissionMode !== 'string' || 
        !['all', 'blacklist', 'whitelist'].includes(validatedConfig.permissionMode)) {
      validatedConfig.permissionMode = this.defaultConfig.permissionMode;
    }
    
    // 修复 notebookList 配置验证问题
    if (!Array.isArray(validatedConfig.notebookList)) {
      // 如果是字符串，尝试解析
      if (typeof validatedConfig.notebookList === 'string') {
        if (validatedConfig.notebookList.trim()) {
          // 处理单个笔记本ID字符串
          validatedConfig.notebookList = [validatedConfig.notebookList.trim()];
        } else {
          validatedConfig.notebookList = [];
        }
      } else {
        validatedConfig.notebookList = this.defaultConfig.notebookList;
      }
    }
    
    // 验证删除保护配置
    if (!validatedConfig.deleteProtection || typeof validatedConfig.deleteProtection !== 'object') {
      validatedConfig.deleteProtection = { ...this.defaultConfig.deleteProtection };
    } else {
      validatedConfig.deleteProtection = {
        safeMode: validatedConfig.deleteProtection.safeMode ?? this.defaultConfig.deleteProtection.safeMode,
        requireConfirmation: validatedConfig.deleteProtection.requireConfirmation ?? this.defaultConfig.deleteProtection.requireConfirmation
      };
    }
    
    // 验证 TLS 配置
    if (!validatedConfig.tls || typeof validatedConfig.tls !== 'object') {
      validatedConfig.tls = { ...this.defaultConfig.tls };
    } else {
      validatedConfig.tls = {
        allowSelfSignedCerts: validatedConfig.tls.allowSelfSignedCerts ?? this.defaultConfig.tls.allowSelfSignedCerts,
        allowedHosts: Array.isArray(validatedConfig.tls.allowedHosts) 
          ? validatedConfig.tls.allowedHosts 
          : this.defaultConfig.tls.allowedHosts
      };
    }
    
    return validatedConfig;
  }
  
  /**
   * 获取配置
   * @returns {Object} 当前配置
   */
  getConfig() {
    return { ...this.config };
  }
  
  /**
   * 获取配置值
   * @param {string} key - 配置键
   * @returns {any} 配置值
   */
  get(key) {
    return this.config[key];
  }
  
  /**
   * 获取配置摘要
   * @returns {Object} 配置摘要
   */
  getSummary() {
    const config = this.getConfig();
    return {
      baseURL: config.baseURL,
      token: config.token ? '***' + config.token.slice(-4) : '未设置',
      timeout: config.timeout,
      defaultNotebook: config.defaultNotebook || '未设置',
      permissionMode: config.permissionMode,
      notebookCount: config.notebookList.length
    };
  }
}

module.exports = ConfigManager;