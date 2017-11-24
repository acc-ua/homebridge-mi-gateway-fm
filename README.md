# homebridge-mi-gateway-play-tone


XiaoMi Gateway Play Tone plugin for HomeBridge.   
   
Thanks for [Mr.Yin](https://github.com/YinHangCode/homebridge-mi-aqara/), [nfarina](https://github.com/nfarina)(the author of [homebridge](https://github.com/nfarina/homebridge)), [OpenMiHome](https://github.com/OpenMiHome/mihome-binary-protocol), [aholstenson](https://github.com/aholstenson)(the author of [miio](https://github.com/aholstenson/miio)), all other developer and testers.   
   
![](https://raw.githubusercontent.com/YinHangCode/homebridge-mi-gateway-fm/master/images/Gateway.jpg)
![](https://raw.githubusercontent.com/YinHangCode/homebridge-mi-gateway-fm/master/images/mi-acpartner.jpg)
![](https://raw.githubusercontent.com/YinHangCode/homebridge-mi-gateway-fm/master/images/aqara-acpartner.jpg)


## Installation
1. Install HomeBridge, please follow it's [README](https://github.com/nfarina/homebridge/blob/master/README.md).   
If you are using Raspberry Pi, please read [Running-HomeBridge-on-a-Raspberry-Pi](https://github.com/nfarina/homebridge/wiki/Running-HomeBridge-on-a-Raspberry-Pi).   
2. Make sure you can see HomeBridge in your iOS devices, if not, please go back to step 1.   
3. Install packages.   
```
npm install -g homebridge-mi-gateway-play-tone
```

## Configuration
```
"accessories": [{
    
      "accessory": "MiGatewayPlayTone",
      "name": "MiGatewayPlayTone",
      "sid": "MAC",
      "password": "PASSWORD",
      "volume":2,
      "toneId": 10005
}]
```

## Configuration
1. Open Aqara gateway's settings, enable [local network protocol](https://github.com/louisZL/lumi-gateway-local-api).  
Please follow the steps in this thread: http://bbs.xiaomi.cn/t-13198850. It's in Chinese so you might need a translator to read it.  
2. To control the devices, put gateway's MAC address (**lower case without colon**) and password (**keep original and case sensitive**) to ~/.homebridge/config.json.   
3. Volume can be specified by 'volume' parameter, and 'toneId' is identifier of the internal or user-uploaded melody. 
  'toneId' can be:
     8,1013,20,21,22,23,24,25,26,27,28,29  -  for gateway's default melodies 
     10000 - stops any playing melodies
     10001 and above - user-uploaded melodies

## Version Logs
### 0.0.1
1. Initial release   
