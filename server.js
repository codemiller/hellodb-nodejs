#!/bin/env node

var restify      = require('restify');
var fs           = require('fs');
var pg           = require('pg');
var mysql        = require('mysql');
var mongo        = require('mongodb').MongoClient;

var HelloDB = function() {

    var self = this;

    self.setupVariables = function() {
        self.ipaddress = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
        self.port      = process.env.OPENSHIFT_NODEJS_PORT || '8080';
        self.dbhost    = process.env.OPENSHIFT_EXT_DB_HOST || '127.0.0.1';
        self.dbport    = process.env.OPENSHIFT_EXT_DB_PORT || '27017';
        self.dbuser    = process.env.OPENSHIFT_EXT_DB_USERNAME || ''; 
        self.dbpass    = process.env.OPENSHIFT_EXT_DB_PASSWORD || ''; 
        self.dbname    = process.env.OPENSHIFT_APP_NAME || 'test';
    };

    self.terminator = function(sig){
        if (typeof sig === "string") {
           console.log('%s: Received %s - terminating sample app ...',
                       Date(Date.now()), sig);
           process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()) );
    };

    self.setupTerminationHandlers = function(){
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() { self.terminator(element); });
        });
    };

    self.dbCallback = function(sendRes) {
        return function(err) {
            if(err) {
                sendRes(err);
                return console.log('Could not connect to database: ', err);
            }
            sendRes('success');
        }
    }
  
    self.connectPostgreSQL = function(sendRes) {
        var conString = 'postgres://' + self.dbuser + ':' + self.dbpass + '@' 
                        + self.dbhost + ':' + self.dbport + '/' + self.dbname;
        var client = new pg.Client(conString);
        client.connect(self.dbCallback(sendRes));
    }

    self.connectMySQL = function(sendRes) {
        var connection = mysql.createConnection({
            host     : self.dbhost,
            port     : self.dbport,
            user     : self.dbuser,
            password : self.dbpass,
            database : self.dbname
        });

        connection.connect(self.dbCallback(sendRes));
        connection.end();
    }

    self.connectMongo = function(sendRes) {
        var conString = 'mongodb://' + self.dbuser + ':' + self.dbpass + '@'
                         + self.dbhost + ':' + self.dbport + '/' + self.dbname;
        mongo.connect(conString, self.dbCallback(sendRes));
    }

    self.tryDbConnection = function(connectFunc) {
        return function(req, res, next) {
            res.setHeader('Content-Type', 'text/plain');
            connectFunc(function(result) {
                if (result == 'success') {
                    res.send(200, 'Connected successfully');
                } else { 
                    res.send(500, 'Could not connect to database');
                } 
            });
            return next();             
        };
    }

    self.createRoutes = function() {
        self.routes = { };

        self.routes['/'] = function(req, res, next) {
            res.setHeader('Content-Type', 'text/plain');
            res.send(200, 'Hello DB! Try \"/postgresql\", \"/mysql\", or \"/mongodb\".');
            return next();
        };

        self.routes['/postgresql'] = self.tryDbConnection(self.connectPostgreSQL); 
        self.routes['/mysql'] = self.tryDbConnection(self.connectMySQL); 
        self.routes['/mongodb'] = self.tryDbConnection(self.connectMongo); 
    };

    self.initializeServer = function() {
        self.createRoutes();
        self.app = restify.createServer();

        for (var r in self.routes) {
            self.app.get(r, self.routes[r]);
        }
    };

    self.initialize = function() {
        self.setupVariables();
        self.setupTerminationHandlers();
        self.initializeServer();
    };

    self.start = function() {
        self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                        Date(Date.now() ), self.ipaddress, self.port);
        });
    };
};  

var app = new HelloDB();
app.initialize();
app.start();
