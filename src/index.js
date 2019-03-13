/**
 * A shortcut for plugin creation
 */
export const createPlugin = (name, version, dependencies, f) => {
  const Plugin = f;

  Plugin.plugin = { name, version, dependencies };

  return Plugin;
};

const compareVersion = function (versionA, versionB) {
  const tokensA = versionA.split('.').map(token => parseInt(token, 10));
  const tokensB = versionB.split('.').map(token => parseInt(token, 10));

  let index = 0;
  while (index < 3) {
    const numberA = index < tokensA.length ? tokensA[index] : 0;
    const numberB = index < tokensB.length ? tokensB[index] : 0;

    if (numberA !== numberB) {
      return numberA > numberB ? 1 : -1;
    }

    index++;
  }

  return 0;
};

/**
 * The main modulee bus
 */
export default class {
  /**
   * Create bus instance
   */
  constructor () {
    this.listeners = [];
    this.plugins   = {};

    this.$id = 0;
  }

  /**
   * Add a new listener
   */
  on (mask, cb, priority = 0) {
    const $id = this.$id++;

    this.listeners.push({ mask, priority, cb, $id });

    /* Return a function whick will delete this listener */
    return () => {
      const oldLength = this.listeners.length;

      this.listeners = this.listeners.filter((l) => l.$id !== $id);

      /* Return a count of removed listeners */
      return oldLength - this.listeners.length;
    };
  }

  /**
   * Add a new self-removing listener
   */
  once (mask, cb, priority) {
    let removed = false;

    const removeListener = this.on(mask, (d) => {
      if (!removed) {
        let result = cb(d);
        removeListener();
        removed = true;
        return result;
      } else {
        return d;
      }
    }, priority);

    return removeListener;
  };

  /**
   * Build a list of listeners for an event
   */
  list (event, doSort = true) {
    return doSort
      ? this.listeners.filter((l) => l.mask === event).sort((a, b) => b.priority - a.priority)
      : this.listeners.filter((l) => l.mask === event);
  }

  /**
   * Emits new event inside bus object and processes input data through
   * all the listeners asynchronously one by one
   */
  emit (event, data) {
    return this.list(event).reduce((result, listener) => result.then((intermediateResult) => listener.cb(intermediateResult)), Promise.resolve(data));
  }

  /**
   * Emits new event inside bus object and processes input data through
   * all the listeners synchronously
   */
  emitSync (event, data) {
    return this.list(event).reduce((result, listener) => listener.cb(result), data);
  }

  /**
   * Emits new event inside bus object and processes input data through
   * all the listeners in parallel asynchronously
   */
  emitParallel (event, data) {
    return Promise.all(this.list(event).map((l) => Promise.resolve(l.cb(data))));
  }

  /**
   * Emits new event inside bus object and processes input data through
   * all the listeners in parallel synchronously
   */
  emitParallelSync (event, data) {
    return this.list(event)
      .map((l) => l.cb(data));
  }

  /**
   * Check the Pluggable for having listeners for such an event
   */
  has (event) {
    return this.list(event, false).length > 0;
  };

  /**
   * Remove listeners for this event
   */
  off (event) {
    return this.listeners = this.listeners.filter((l) => !l.mask === event);
  };

  /**
   * Adds a plugin to pluggable instance
   */
  plugin (pl, options) {
    /* Check the plugin for being currently installed */
    if (this.plugins[pl.plugin.name])
      throw new Error('Plugin ' + pl.plugin.name + ' is already installed!');

    /* Check plugins dependencies */
    Object.keys(pl.plugin.dependencies).forEach((key) => {
      if (!this.plugins[key]) {
        throw new Error("Plugin '" + key + "' is requred by '" + pl.plugin.name + "', but not installed!");
      } else {
        const versionNeeded = pl.plugin.dependencies[key];
        const versionProvided = this.plugins[key].version;

        if (compareVersion(versionNeeded, versionProvided) > 0) {
          throw new Error("Plugin '" + key + "' version " + versionNeeded + " is requred by '" + pl.plugin.name + "', but only " + versionProvided + " is provided!");
        }
      }
    });

    /* Insert plugin */
    pl(this, options);

    /* Register plugin */
    this.plugins[pl.plugin.name] = pl.plugin;
  };
};
