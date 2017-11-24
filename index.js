const dgram = require('dgram');
const crypto = require('crypto');
var fs = require('fs');
const miio = require('miio');


const iv = Buffer.from([0x17, 0x99, 0x6d, 0x09, 0x3d, 0x28, 0xdd, 0xb3, 0xba, 0x69, 0x5a, 0x2e, 0x6f, 0x58, 0x56, 0x2e]);

const serverSocket = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true
});

const multicastAddress = '224.0.0.50';
const multicastPort = 4321;
const serverPort = 9898;


var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
    if(!isConfig(homebridge.user.configPath(), "accessories", "MiGatewayPlayTone")) {
        return;
    }

    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerAccessory('homebridge-mi-gateway-play-tone', 'MiGatewayPlayTone', MiGatewayPlayTone);
}


function isConfig(configFile, type, name) {
    var config = JSON.parse(fs.readFileSync(configFile));
    if("accessories" === type) {
        var accessories = config.accessories;
        for(var i in accessories) {

            if(accessories[i]['accessory'] === name) {
                return true;
            }
        }
    } else if("platforms" === type) {
        var platforms = config.platforms;
        for(var i in platforms) {
            if(platforms[i]['platform'] === name) {
                return true;
            }
        }
    } else {
    }
    
    return false;
}



function MiGatewayPlayTone(log, config) {
    if(null == config) {
        return;
    }

    this._promises = {};
    this._hasFailedToken = false;
    this._id = 0;
    this.log = log;
    this.config = config;
    this.port = config.port || 9898;
    this.initServerSocket();
    this._gatewayInternalToken = '';
    this._gatewayInternalIP = this.config.ip;

}

MiGatewayPlayTone.prototype = {
    identify: function(callback) {
        callback();
    },

    initServerSocket:function() {
    var that = this;
    
    serverSocket.on('error', function(err){
        that.log.error('error, msg - %s, stack - %s\n', err.message, err.stack);
    });
    
    serverSocket.on('listening', function(){
        that.log.info("server is listening on port 9898.");
        serverSocket.addMembership(multicastAddress);
    });
    
    serverSocket.on('message', this.parseMessage.bind(this));
    
    serverSocket.bind(serverPort);
}
,
 parseMessage: function(msg, rinfo){
    var that = this;

  that.log.debug(msg);
    var jsonObj;
    try {
        jsonObj = JSON.parse(msg);
    } catch (ex) {
        that.log.error("Bad msg %s", msg);
        return;
    }
    
    var cmd = jsonObj['cmd'];
    if (cmd === 'write_ack'  && jsonObj['model'] == 'gateway') {
        var msgTag = 'write_' + jsonObj['sid'];
        const p = that.getPromises(msgTag);
        if(!p) {
            //that.log.warn("[Revc]" + msg);
            return;
        } else {
            //that.log.debug("[Revc]" + msg);
            if(jsonObj['data'] && jsonObj['data'].indexOf('error') > -1) {
                p.reject(new Error(JSON.parse(jsonObj['data'])['error']));
            } else if(jsonObj['data'] && jsonObj['data'].indexOf('unknown') > -1) {
                p.reject(new Error(jsonObj['data']));
            } else {
                p.resolve(jsonObj);
            }
        }
    } else if (cmd === 'read_ack' && jsonObj['model'] == 'gateway') {
        var msgTag = 'read_' + jsonObj['sid'];
        const p = that.getPromises(msgTag);
        if(!p) {
            //that.log.warn("[Revc]" + msg);
            return;
        } else {
          //  that.log.debug("[Revc]" + msg);
            if(jsonObj['data'] && jsonObj['data'].indexOf('error') > -1) {
                p.reject(new Error(JSON.parse(jsonObj['data'])['error']));
            } else {
                p.resolve(jsonObj);
            }
        }
     
    } else if (cmd === 'heartbeat' && jsonObj['model'] == 'gateway') {
       that.log.warn("[heartbeat]" + msg);
       _gatewayInternalToken  = jsonObj['token'];

       try {
            var data = JSON.parse(jsonObj['data']);
            if(data['ip'])
            {
                 this._gatewayInternalIP = data['ip'];
                 that.log.warn("FOUND IP of gateway" + data['ip']);
             }
        } catch (ex) {
            that.log.error("Bad msg %s", msg);
            return;
        }
    }
    else {
        //that.log.warn("[Revc]" + msg);
    }
},


sendWriteCommand:function(command, options) {
    var that = this;
    return new Promise((resolve, reject) => {

        var deviceSid = this.config.sid; //gateway sid
        var devicePassword = this.config.password; 
        var gatewayToken = _gatewayInternalToken ;//this.config.token; //Buffer.from(, 'hex');

        
        var cipher = crypto.createCipheriv('aes-128-cbc', devicePassword, iv);
        var key = cipher.update(gatewayToken, "ascii", "hex");
        cipher.final('hex'); // Useless data, don't know why yet.
        
        command = command.replace('${key}', key);
        var msgTag = 'write_' + deviceSid + "_t" + that.getPromisesTagSerialNumber();
        that.sendCommand(this._gatewayInternalIP, this.port, msgTag, command, options).then(result => {
            resolve(result);
        }).catch(function(err) {
            reject(err);
        });
    })
},
 
  sendCommand : function(ip, port, msgTag, msg, options)  {
    var that = this;
    return new Promise((resolve, reject) => {
        if(!that.PromisesSendCommand) {
            that.PromisesSendCommand = {};
        }
        
        const triggerCorrelationPromises = (fun, res) => {
            var promisesSendCommands = that.PromisesSendCommand[ip + port + msg];
            if(promisesSendCommands) {
                promisesSendCommands = promisesSendCommands.concat();
                delete that.PromisesSendCommand[ip + port + msg];
                promisesSendCommands.forEach(function(promisesSendCommand, index, arr) {
                    const p = that._promises[promisesSendCommand];
                    if(p) {
                        p[fun](res);
                    }
                });
            }
        }
        
        let retryLeft =   3;
        const send = () => {
            retryLeft --;
            this.log.debug("[Send]" + msg);
            serverSocket.send(msg, 0, msg.length, port, ip, err => err && reject(err));
        }
        const _sendTimeout = setInterval(() => {
            if(retryLeft > 0) {
                send();
            } else {
                clearInterval(_sendTimeout);
                delete that._promises[msgTag];
                var err = new Error('timeout: ' + msg);
                triggerCorrelationPromises('reject', err);
                reject(err);
            }
        }, 1 * 1000);
            
        that._promises[msgTag] = {
            resolve: res => {
                clearInterval(_sendTimeout);
                delete that._promises[msgTag];
                triggerCorrelationPromises('resolve', res);
                resolve(res);
            },
            reject: err => {
                clearInterval(_sendTimeout);
                delete that._promises[msgTag];
                triggerCorrelationPromises('reject', err);
                reject(err);
            }
        };
        
        if(that.PromisesSendCommand[ip + port + msg]) {
            that.PromisesSendCommand[ip + port + msg].push(msgTag);
        } else {
            that.PromisesSendCommand[ip + port + msg] = [];
            send();
        }
    })
},
  
  getServices: function() {
        var services = [];
        var index = 1;
        var infoService = new Service.AccessoryInformation();
        infoService
            .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
            .setCharacteristic(Characteristic.Model, "Xiaomi Gateway Play Tone Button")
            .setCharacteristic(Characteristic.SerialNumber, "Xiaomi-Gateway-Play-Tone-Button-"+index);
        services.push(infoService);

        this.btnService = new Service.Switch(this.config['name']);
         this.btnService
            .getCharacteristic(Characteristic.On)
            .on('get', this.getGStatus.bind(this))
            .on('set', this.setGStatus.bind(this));
        services.push( this.btnService);

        return services;
    },

    getGStatus: function(callback) {
        var that = this;
        callback(null, false);
    },

    setGStatus: function(value, callback) {
     
      if(value)
      {
        var that = this;
        var mid = this.config.toneId || 10005;
        var vol = this.config.volume || 3;
     
        var command = '{"cmd":"write","model":"gateway","sid":"' + this.config.sid + '","short_id":0,"data":"{\\"mid\\":' + mid + ',\\"vol\\":'+vol+',\\"key\\":\\"${key}\\"}"}';               
        this.sendWriteCommand(command).then(result => {
                  
                    
                    that.autoOffTimeout = setTimeout(() => {
                               that.btnService.setCharacteristic(Characteristic.On, 0);
                               clearTimeout(that.autoOffTimeout);
                    }, 1000);
                    
                }).catch(function(err) {
                    that.log.error("[MiGatewayFM][ERROR]setGStatus Error: " + err);
                    callback(err);
                });
      }
        callback(null);


    }
    ,

    getPromises : function(msgTag) {
    var resultTag = null;
    for(var promisesTag in this._promises) {
        if(promisesTag.indexOf(msgTag) > -1) {
            if(null == resultTag || Number(resultTag.slice(resultTag.indexOf('_t')+2)) > Number(promisesTag.slice(promisesTag.indexOf('_t')+2))) {
                resultTag = promisesTag;
            }
        }
    }
    return this._promises[resultTag];
  }
,

getPromisesTagSerialNumber : function() {
    if(null == this.PromisesTagSerialNumber) {
        this.PromisesTagSerialNumber = {
            time: new Date().Format("yyyyMMddhhmmss"),
            num: 0
        }
    } else {
        if(new Date().Format("yyyyMMddhhmmss") != this.PromisesTagSerialNumber.time) {
            this.PromisesTagSerialNumber.time = new Date().Format("yyyyMMddhhmmss");
            this.PromisesTagSerialNumber.num = 0;
        }
    }
    return this.PromisesTagSerialNumber.time + (this.PromisesTagSerialNumber.num++);
}


}


