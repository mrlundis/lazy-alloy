fs = require("node-fs")
match = require("match-files")
coffee = require("coffee-script")
jade = require("jade")
sty = require('sty')
util = require('util')
app = null

directory = process.cwd()

pad = (n) ->  
  if n < 10 then '0'+n else n
formatDate = () ->
  d = new Date
  "#{d.getFullYear()}-#{pad d.getMonth()}-#{pad d.getDate()} #{pad d.getHours()}:#{pad d.getMinutes()}:#{pad d.getSeconds()}: "

console.info = (msg) ->
  console.log sty.green formatDate() + msg

console.debug = (msg) ->
  console.log sty.magenta formatDate() + msg

console.error = (msg) ->
  console.log sty.bold sty.red formatDate() + msg



class Application
  constructor: ->
    app = this
    @program = require('commander')
    @titanium = null

    @program
      .version('0.0.5')
      .usage('[COMMAND] [OPTIONS]')
      #.option('-s, --setup', 'Setup lazy-alloy directory structure.')
      # .option('-c, --compile', 'Just compile.')
      # .option('-w, --watch', 'Watch file changes & compile.')
      .option('-p, --platform [platform]', '(watch) When done, run titanium on `platform`')
      .option('-d, --directory [dirname]', 'Set source directory (default `src/`)')

    @program.command('compile')
      .description('Just compile.')
      .action(@compile)

    @program.command('watch')
      .description('Watch file changes & compile.')
      .action(@watch)

    @program.command('build <platform>')
      .description('Run titanium on `platform`')
      .action(@build)

    @program.command('new')
      .description('Setup the lazy-alloy directory structure.')
      .action(@setup)

    @program.command('generate [type] [name]')
      .description('Generate a new (lazy-)alloy type such as a controller, model, lib.')
      .action(@generate)

    @program.parse(process.argv)

  # start: ->
  #   return @compile() if @program.compile
  #   return @watch() if @program.watch
  #   return @build() if @program.platform

  #   console.info "nothing to do!"

  start: ->
    @subfolder = if @program.directory
      @program.directory += '/' unless @program.directory.charAt(subfolder.length-1) == '/'
    else
     'src/'
    @compiler = new Compiler(@subfolder)

  compile: ->
    app.start()
    app.compiler.all()

  build: (platform = app.program.platform) ->
    app.start()
    spawn = require("child_process").spawn
    exec = require("child_process").exec

    if app.titanium isnt null
      console.info "stopping titanium..."
      app.titanium.kill()

    alloy = exec "alloy compile", (error, stdout, stderr) ->
      console.debug stdout if stdout
      console.log stderr if stderr

    alloy.on 'exit', (code) =>
      console.log "alloy stopped with code #{ code }"

      if code isnt 1
        console.info "starting titanium..."

        @titanium = spawn "titanium", ["build", "-p", platform]

        @titanium.stdout.on "data", (data) ->
          console.log "titanium: " + data

        @titanium.stderr.on "data", (data) ->
          console.log "titanium: " + data

        @titanium.on "exit", (code) ->
          console.log "titanium exited with code " + code

  watch: ->
    app.start()
    watchr = require("watchr")

    console.info "Waiting for file change..."

    watchr.watch
      paths: [directory + '/src']
      ignoreHiddenFiles: true
      listeners:
        error: (err) ->
          console.log "an error occured:", err

        change: (changeType, filePath, fileCurrentStat, filePreviousStat) =>
          return unless changeType in ["create", "update"]

          #only compile correct files
          file = getFileType filePath
          return unless file

          app.compiler.files [filePath], file.fromTo[0], file.fromTo[1]

          app.build() if app.program.platform

    next: (err, watchers) ->
      if err
        return console.log("watching everything failed with error", err)
      else
        console.debug "Waiting for file change..."

  setup: ->
    app.start()
    new Generator().setup app.subfolder

  generate: (type, name) ->
    app.start()
    app.type = type
    app.name = name
    app.ensureType()

  ensureType: ->
    if app.type
      app.ensureName()
    else
      console.debug 'What should I generate?'
      app.program.choose ['controller', 'view', 'model', 'lib', 'widget'], app.ensureName

  ensureName: (i, type) ->
    app.type = type if type
    if app.name # might not be needed for all future generators
      app.startGenerator()
    else
      app.program.prompt "Please enter a name for your #{app.type}: ", app.startGenerator

  startGenerator: (name) ->
    app.name = name if name
    new Generator().generate app.type, app.name

  getFileType = (path) ->
    #check if file path contains string
    inpath = (name) ->
      path.indexOf(name) > -1

    return {type: "view", fromTo: ["jade", "xml"]} if inpath ".jade"
    return {type: "widgets/view", fromTo: ["jade", "xml"]} if inpath "widgets/view"

    return null unless inpath ".coffee"

    return {type: "style", fromTo: ["coffee", "tss"]} if inpath "styles/"
    return {type: "alloy", fromTo: ["coffee", "js"]} if inpath "alloy.coffee"
    return {type: "controller", fromTo: ["coffee", "js"]} if inpath "controllers/"
    return {type: "model", fromTo: ["coffee", "js"]} if inpath "models/"
    return {type: "lib", fromTo: ["coffee", "js"]} if inpath "lib/"
    return {type: "widgets/style", fromTo: ["coffee", "tss"]} if inpath "widgets/style"
    return {type: "widgets/controller", fromTo: ["coffee", "js"]} if inpath "widgets/controller"

class Compiler
  logger: console
  constructor: (@subfolder = 'src/') ->

  views: ->
    @process "views/", "jade", "xml"

  controllers: ->
    @process "controllers/", "coffee", "js"

  models: ->
    @process "models/", "coffee", "js"

  styles: ->
    @process "styles/", "coffee", "tss"

  widgets: ->
    widgetPath = @subfolder + "widgets/"
    
    if fs.existsSync widgetPath
      widgets = fs.readdirSync widgetPath
      
      for widget in widgets
        @process "widgets/#{widget}/views/", "jade", "xml"
        @process "widgets/#{widget}/styles/", "coffee", "tss"
        @process "widgets/#{widget}/controllers/", "coffee", "js"

  lib: ->
    @process "lib/", "coffee", "js"

  alloy: ->
    @process "./alloy.coffee", "coffee", "js"

  all: ->
    @views()
    @controllers()
    @models()
    @styles()
    @widgets()
    @lib()
    @alloy()

  process: (path, from, to) ->
    path = @subfolder + path
    @logger.info "Preprocessing #{ from } files in #{ path }"

    filter = (dir) ->
      # It should contain the expected extension but not a hidden file (starting with a dot)
      dir.indexOf(".#{ from }") isnt -1 and dir.indexOf(".") isnt 0

    match.find (process.cwd() + "/" + path), {fileFilters: [filter]}, (err, files) => @files files, from, to

  file: (from, output, type) ->
    @logger.info "[#{type}] #{from} --> #{output}"

    data = fs.readFileSync from, 'utf8'
    
    try
      compiled = @build[type] data, from
    catch e
      console.error "[#{type}] Failed to compile #{from}"
      console.debug "[#{type}] #{e}, on line #{e.location.first_line} column #{e.location.first_column}"

    # Create the base path
    @mkdirPSync from.split('/')[0...-1]
    fs.writeFileSync output, compiled, 'utf8'

  files: (files, from, to, to_path) ->
    return @logger.debug "No '*.#{from}' files need to preprocess.. #{files.length} files" if files.length is 0

    for file in files
      break if file.indexOf("lazyalloy") > -1

      # Replace file extention
      output = file.substring(0, file.length - from.length).toString() + to

      # Replace subfolder with app. Only last occurence in case it exists twice in the path.
      output = output.replace(new RegExp('(.*)'+@subfolder), '$1app/')

      @file file, output, to

  build:
    xml: (data, from) ->
      jade.render(data,
        pretty: true,
        filename: from
      )

    tss: (data, from) ->
      data = @js data

      (data.replace "};", "").replace """
        var tss;

        tss = {

        """, ""

    js: (data, from) ->
      coffee.compile data.toString(), {bare: true}

    json: (data) ->
      data

  # The equivalent of running `mkdir -p <path>` on the command line
  mkdirPSync: (segments, pos=0) ->
    return if pos >= segments.length
    # Construct path at current segment
    segment = segments[pos]
    path = segments[0..pos].join '/'

    # Create path if it doesn't exist
    if path.length > 0
      unless fs.existsSync path
        fs.mkdirSync path
    # Go deeper
    @mkdirPSync segments, pos + 1

class Generator
  setup: (subfolder) ->
    console.info "Setting up folder structure at #{subfolder}"
    mkdir subfolder
    mkdir subfolder+'views'
    mkdir subfolder+'styles'
    mkdir subfolder+'controllers'
    mkdir subfolder+'models'
    mkdir subfolder+'widgets'
    mkdir subfolder+'lib'
    console.debug 'Setup complete.'
    process.exit()

  generate: (type, name) ->
    switch type
      when 'controller'
        createController name
      when 'model'
        createModel name
      when 'lib'
        createLib name
      when 'jmk'
        not_yet_implemented()
      when 'model'
        createModel name
      when 'migration'
        not_yet_implemented()
      when 'view'
        createView name
      when 'widget'
        createWidget name
      else
        console.info "Don't know how to build #{type}"
    process.exit()

  createController = (name) ->
    console.debug "Creating controller #{name}"
    touch app.subfolder + 'controllers/' + name + '.coffee'
    createView name

  createModel = (name) ->
    console.debug "Creating model #{name}"
    touch app.subfolder + 'models/' + name + '.coffee'
    createView name

  createLib = (name) ->
    console.debug "Creating lib #{name}"
    touch app.subfolder + 'lib/' + name + '.coffee'

  createView = (name) ->
    console.debug "Building view #{name}"
    touch app.subfolder + 'views/' + name + '.jade'
    createStyle name

  createStyle = (name) ->
    console.debug "Building style #{name}"
    touch app.subfolder + 'styles/' + name + '.coffee'

  createModel = (name) ->
    console.debug "Building model #{name}"
    touch app.subfolder + 'models/' + name + '.coffee'

  createWidget = (name) ->
    console.debug "Creating widget #{name}"
    mkdir app.subfolder + 'widgets/'
    mkdir app.subfolder + 'widgets/' + name
    mkdir app.subfolder + 'widgets/' + name + '/controllers/'
    mkdir app.subfolder + 'widgets/' + name + '/views/'
    mkdir app.subfolder + 'widgets/' + name + '/styles/'
    touch app.subfolder + 'widgets/' + name + '/controllers/widget.coffee'
    touch app.subfolder + 'widgets/' + name + '/views/widget.jade'
    touch app.subfolder + 'widgets/' + name + '/styles/widget.coffee'

  createLibrary = (name) ->
    console.debug "Creating library #{name}"
    touch app.subfolder + 'lib/' + name + '.coffee'

  not_yet_implemented = ->
    console.info "This generator hasn't been built into lazy-alloy yet. Please help us out by building it in:"
    console.info "https://github.com/vastness/lazy-alloy"

  mkdir = (path) ->
    execUnlessExists fs.mkdirSync, path
  touch = (path) ->
    execUnlessExists fs.openSync, path, 'w'
  execUnlessExists = (func, path, attr = null) ->
    if fs.existsSync(path)
      console.debug("#{path} already exists, doing nothing")
    else
      func path, attr

module.exports = new Application
