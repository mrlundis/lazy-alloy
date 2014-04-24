// Generated by CoffeeScript 1.6.3
var Application, Compiler, Generator, app, coffee, directory, formatDate, fs, jade, match, pad, sty, util;

fs = require("node-fs");

match = require("match-files");

coffee = require("coffee-script");

jade = require("jade");

sty = require('sty');

util = require('util');

app = null;

directory = process.cwd();

pad = function(n) {
  if (n < 10) {
    return '0' + n;
  } else {
    return n;
  }
};

formatDate = function() {
  var d;
  d = new Date;
  return "" + (d.getFullYear()) + "-" + (pad(d.getMonth())) + "-" + (pad(d.getDate())) + " " + (pad(d.getHours())) + ":" + (pad(d.getMinutes())) + ":" + (pad(d.getSeconds())) + ": ";
};

console.info = function(msg) {
  return console.log(sty.green(formatDate() + msg));
};

console.debug = function(msg) {
  return console.log(sty.magenta(formatDate() + msg));
};

console.error = function(msg) {
  return console.log(sty.bold(sty.red(formatDate() + msg)));
};

Application = (function() {
  var getFileType;

  function Application() {
    app = this;
    this.program = require('commander');
    this.titanium = null;
    this.program.version('0.0.5').usage('[COMMAND] [OPTIONS]').option('-p, --platform [platform]', '(watch) When done, run titanium on `platform`').option('-d, --directory [dirname]', 'Set source directory (default `src/`)');
    this.program.command('compile').description('Just compile.').action(this.compile);
    this.program.command('watch').description('Watch file changes & compile.').action(this.watch);
    this.program.command('run').description('Compile all files and watch for changes').action(this.compile).action(this.watch);
    this.program.command('build <platform>').description('Run titanium on `platform`').action(this.build);
    this.program.command('new').description('Setup the lazy-alloy directory structure.').action(this.setup);
    this.program.command('generate [type] [name]').description('Generate a new (lazy-)alloy type such as a controller, model, lib.').action(this.generate);
    this.program.parse(process.argv);
  }

  Application.prototype.start = function() {
    this.subfolder = this.program.directory ? this.program.directory.charAt(subfolder.length - 1) !== '/' ? this.program.directory += '/' : void 0 : 'src/';
    return this.compiler = new Compiler(this.subfolder);
  };

  Application.prototype.compile = function() {
    app.start();
    return app.compiler.all();
  };

  Application.prototype.build = function(platform) {
    var alloy, exec, spawn,
      _this = this;
    if (platform == null) {
      platform = app.program.platform;
    }
    app.start();
    spawn = require("child_process").spawn;
    exec = require("child_process").exec;
    if (app.titanium !== null) {
      console.info("stopping titanium...");
      app.titanium.kill();
    }
    alloy = exec("alloy compile", function(error, stdout, stderr) {
      if (stdout) {
        console.debug(stdout);
      }
      if (stderr) {
        return console.log(stderr);
      }
    });
    return alloy.on('exit', function(code) {
      console.log("alloy stopped with code " + code);
      if (code !== 1) {
        console.info("starting titanium...");
        _this.titanium = spawn("titanium", ["build", "-p", platform]);
        _this.titanium.stdout.on("data", function(data) {
          return console.log("titanium: " + data);
        });
        _this.titanium.stderr.on("data", function(data) {
          return console.log("titanium: " + data);
        });
        return _this.titanium.on("exit", function(code) {
          return console.log("titanium exited with code " + code);
        });
      }
    });
  };

  Application.prototype.watch = function() {
    var watchr,
      _this = this;
    app.start();
    watchr = require("watchr");
    console.info("Waiting for file change...");
    watchr.watch({
      paths: [directory + '/src'],
      ignoreHiddenFiles: true,
      listeners: {
        error: function(err) {
          return console.log("an error occured:", err);
        },
        change: function(changeType, filePath, fileCurrentStat, filePreviousStat) {
          var file;
          if (changeType !== "create" && changeType !== "update") {
            return;
          }
          file = getFileType(filePath);
          if (!file) {
            return;
          }
          app.compiler.files([filePath], file.fromTo[0], file.fromTo[1]);
          if (app.program.platform) {
            return app.build();
          }
        }
      }
    });
    return {
      next: function(err, watchers) {
        if (err) {
          return console.log("watching everything failed with error", err);
        } else {
          return console.debug("Waiting for file change...");
        }
      }
    };
  };

  Application.prototype.setup = function() {
    app.start();
    return new Generator().setup(app.subfolder);
  };

  Application.prototype.generate = function(type, name) {
    app.start();
    app.type = type;
    app.name = name;
    return app.ensureType();
  };

  Application.prototype.ensureType = function() {
    if (app.type) {
      return app.ensureName();
    } else {
      console.debug('What should I generate?');
      return app.program.choose(['controller', 'view', 'model', 'lib', 'widget'], app.ensureName);
    }
  };

  Application.prototype.ensureName = function(i, type) {
    if (type) {
      app.type = type;
    }
    if (app.name) {
      return app.startGenerator();
    } else {
      return app.program.prompt("Please enter a name for your " + app.type + ": ", app.startGenerator);
    }
  };

  Application.prototype.startGenerator = function(name) {
    if (name) {
      app.name = name;
    }
    return new Generator().generate(app.type, app.name);
  };

  getFileType = function(path) {
    var inpath;
    inpath = function(name) {
      return path.indexOf(name) > -1;
    };
    if (inpath(".jade")) {
      return {
        type: "view",
        fromTo: ["jade", "xml"]
      };
    }
    if (inpath("widgets/view")) {
      return {
        type: "widgets/view",
        fromTo: ["jade", "xml"]
      };
    }
    if (!inpath(".coffee")) {
      return null;
    }
    if (inpath("styles/")) {
      return {
        type: "style",
        fromTo: ["coffee", "tss"]
      };
    }
    if (inpath("alloy.coffee")) {
      return {
        type: "alloy",
        fromTo: ["coffee", "js"]
      };
    }
    if (inpath("controllers/")) {
      return {
        type: "controller",
        fromTo: ["coffee", "js"]
      };
    }
    if (inpath("models/")) {
      return {
        type: "model",
        fromTo: ["coffee", "js"]
      };
    }
    if (inpath("lib/")) {
      return {
        type: "lib",
        fromTo: ["coffee", "js"]
      };
    }
    if (inpath("widgets/style")) {
      return {
        type: "widgets/style",
        fromTo: ["coffee", "tss"]
      };
    }
    if (inpath("widgets/controller")) {
      return {
        type: "widgets/controller",
        fromTo: ["coffee", "js"]
      };
    }
  };

  return Application;

})();

Compiler = (function() {
  Compiler.prototype.logger = console;

  function Compiler(subfolder) {
    this.subfolder = subfolder != null ? subfolder : 'src/';
  }

  Compiler.prototype.views = function() {
    return this.process("views/", "jade", "xml");
  };

  Compiler.prototype.controllers = function() {
    return this.process("controllers/", "coffee", "js");
  };

  Compiler.prototype.models = function() {
    return this.process("models/", "coffee", "js");
  };

  Compiler.prototype.styles = function() {
    return this.process("styles/", "coffee", "tss");
  };

  Compiler.prototype.widgets = function() {
    var widget, widgetPath, widgets, _i, _len, _results;
    widgetPath = this.subfolder + "widgets/";
    if (fs.existsSync(widgetPath)) {
      widgets = fs.readdirSync(widgetPath);
      _results = [];
      for (_i = 0, _len = widgets.length; _i < _len; _i++) {
        widget = widgets[_i];
        this.process("widgets/" + widget + "/views/", "jade", "xml");
        this.process("widgets/" + widget + "/styles/", "coffee", "tss");
        _results.push(this.process("widgets/" + widget + "/controllers/", "coffee", "js"));
      }
      return _results;
    }
  };

  Compiler.prototype.lib = function() {
    return this.process("lib/", "coffee", "js");
  };

  Compiler.prototype.alloy = function() {
    return this.process("./alloy.coffee", "coffee", "js");
  };

  Compiler.prototype.all = function() {
    this.views();
    this.controllers();
    this.models();
    this.styles();
    this.widgets();
    this.lib();
    return this.alloy();
  };

  Compiler.prototype.process = function(path, from, to) {
    var filter,
      _this = this;
    path = this.subfolder + path;
    this.logger.info("Preprocessing " + from + " files in " + path);
    filter = function(dir) {
      return dir.indexOf("." + from) !== -1 && dir.indexOf(".") !== 0;
    };
    return match.find(process.cwd() + "/" + path, {
      fileFilters: [filter]
    }, function(err, files) {
      return _this.files(files, from, to);
    });
  };

  Compiler.prototype.file = function(from, output, type) {
    var compiled, data, e;
    this.logger.info("[" + type + "] " + from + " --> " + output);
    data = fs.readFileSync(from, 'utf8');
    try {
      compiled = this.build[type](data, from);
    } catch (_error) {
      e = _error;
      console.error("[" + type + "] Failed to compile " + from);
      if (e.location) {
        console.debug("[" + type + "] " + e + ", on line " + e.location.first_line + " column " + e.location.first_column);
      } else {
        console.debug("[" + type + "] " + e);
      }
      throw e;
    }
    this.mkdirPSync(from.split('/').slice(0, -1));
    return fs.writeFileSync(output, compiled, 'utf8');
  };

  Compiler.prototype.files = function(files, from, to, to_path) {
    var file, output, _i, _len, _results;
    if (files.length === 0) {
      return this.logger.debug("No '*." + from + "' files need to preprocess.. " + files.length + " files");
    }
    _results = [];
    for (_i = 0, _len = files.length; _i < _len; _i++) {
      file = files[_i];
      if (file.indexOf("lazyalloy") > -1) {
        break;
      }
      output = file.substring(0, file.length - from.length).toString() + to;
      output = output.replace(new RegExp('(.*)' + this.subfolder), '$1app/');
      _results.push(this.file(file, output, to));
    }
    return _results;
  };

  Compiler.prototype.build = {
    xml: function(data, from) {
      var compiler, extendFile, extendName;
      compiler = module.exports.compiler;
      extendName = data.match(/extends? ['"]?(.+)['"]?/);
      if (extendName && extendName[1]) {
        extendFile = from.split('/').slice(0, -1).join('/') + '/' + extendName[1] + '.jade';
        compiler.templateDependees = compiler.templateDependees || {};
        compiler.templateDependees[extendFile] = compiler.templateDependees[extendFile] || [];
        if (compiler.templateDependees[extendFile].indexOf(from) === -1) {
          compiler.templateDependees[extendFile].push(from);
        }
      }
      if (from in compiler.templateDependees) {
        compiler.files(compiler.templateDependees[from], 'jade', 'xml');
      }
      return jade.render(data, {
        pretty: true,
        filename: from
      });
    },
    tss: function(data, from) {
      data = this.js(data);
      return (data.replace("};", "")).replace("var tss;\n\ntss = {\n", "");
    },
    js: function(data, from) {
      return coffee.compile(data.toString(), {
        bare: true
      });
    },
    json: function(data) {
      return data;
    }
  };

  Compiler.prototype.mkdirPSync = function(segments, pos) {
    var path, segment;
    if (pos == null) {
      pos = 0;
    }
    if (pos >= segments.length) {
      return;
    }
    segment = segments[pos];
    path = segments.slice(0, +pos + 1 || 9e9).join('/');
    if (path.length > 0) {
      if (!fs.existsSync(path)) {
        fs.mkdirSync(path);
      }
    }
    return this.mkdirPSync(segments, pos + 1);
  };

  return Compiler;

})();

Generator = (function() {
  var createController, createLib, createLibrary, createModel, createStyle, createView, createWidget, execUnlessExists, mkdir, not_yet_implemented, touch;

  function Generator() {}

  Generator.prototype.setup = function(subfolder) {
    console.info("Setting up folder structure at " + subfolder);
    mkdir(subfolder);
    mkdir(subfolder + 'views');
    mkdir(subfolder + 'styles');
    mkdir(subfolder + 'controllers');
    mkdir(subfolder + 'models');
    mkdir(subfolder + 'widgets');
    mkdir(subfolder + 'lib');
    console.debug('Setup complete.');
    return process.exit();
  };

  Generator.prototype.generate = function(type, name) {
    switch (type) {
      case 'controller':
        createController(name);
        break;
      case 'model':
        createModel(name);
        break;
      case 'lib':
        createLib(name);
        break;
      case 'jmk':
        not_yet_implemented();
        break;
      case 'model':
        createModel(name);
        break;
      case 'migration':
        not_yet_implemented();
        break;
      case 'view':
        createView(name);
        break;
      case 'widget':
        createWidget(name);
        break;
      default:
        console.info("Don't know how to build " + type);
    }
    return process.exit();
  };

  createController = function(name) {
    console.debug("Creating controller " + name);
    touch(app.subfolder + 'controllers/' + name + '.coffee');
    return createView(name);
  };

  createModel = function(name) {
    console.debug("Creating model " + name);
    touch(app.subfolder + 'models/' + name + '.coffee');
    return createView(name);
  };

  createLib = function(name) {
    console.debug("Creating lib " + name);
    return touch(app.subfolder + 'lib/' + name + '.coffee');
  };

  createView = function(name) {
    console.debug("Building view " + name);
    touch(app.subfolder + 'views/' + name + '.jade');
    return createStyle(name);
  };

  createStyle = function(name) {
    console.debug("Building style " + name);
    return touch(app.subfolder + 'styles/' + name + '.coffee');
  };

  createModel = function(name) {
    console.debug("Building model " + name);
    return touch(app.subfolder + 'models/' + name + '.coffee');
  };

  createWidget = function(name) {
    console.debug("Creating widget " + name);
    mkdir(app.subfolder + 'widgets/');
    mkdir(app.subfolder + 'widgets/' + name);
    mkdir(app.subfolder + 'widgets/' + name + '/controllers/');
    mkdir(app.subfolder + 'widgets/' + name + '/views/');
    mkdir(app.subfolder + 'widgets/' + name + '/styles/');
    touch(app.subfolder + 'widgets/' + name + '/controllers/widget.coffee');
    touch(app.subfolder + 'widgets/' + name + '/views/widget.jade');
    return touch(app.subfolder + 'widgets/' + name + '/styles/widget.coffee');
  };

  createLibrary = function(name) {
    console.debug("Creating library " + name);
    return touch(app.subfolder + 'lib/' + name + '.coffee');
  };

  not_yet_implemented = function() {
    console.info("This generator hasn't been built into lazy-alloy yet. Please help us out by building it in:");
    return console.info("https://github.com/vastness/lazy-alloy");
  };

  mkdir = function(path) {
    return execUnlessExists(fs.mkdirSync, path);
  };

  touch = function(path) {
    return execUnlessExists(fs.openSync, path, 'w');
  };

  execUnlessExists = function(func, path, attr) {
    if (attr == null) {
      attr = null;
    }
    if (fs.existsSync(path)) {
      return console.debug("" + path + " already exists, doing nothing");
    } else {
      return func(path, attr);
    }
  };

  return Generator;

})();

module.exports = new Application;
