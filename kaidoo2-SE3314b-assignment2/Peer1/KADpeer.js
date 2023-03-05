var net = require("net");
var handler = require("./KADPTP");
let singleton = require('./Singleton')
var path = require("path");
let argv = require('minimist')(process.argv.slice(2));
let PORT = 3000;
let HOST = '127.0.0.1';
 
//Creatig a DHT table
let DHTable = []
let p2p=require('./cP2PPacket')
net.bytesWritten = 300000;
net.bufferSize = 300000;

//Creating a new server connection
let peer = net.createServer(); 
peer.listen(PORT, HOST, function(){
  singleton.init();

  if(argv.p){
    let counter=0;
    let K = []
    let hostPort = argv.p.split(":");
    
    let client = new net.Socket;
    let peerID = singleton.getPeerID(hostPort[0],hostPort[1])

    client.connect(hostPort[1], hostPort[0], function() {
    
    let peerInfo={host: '127.0.0.1',port: hostPort[1],peerID: peerID}
    K[counter] = peerInfo
    console.log(K)
    refreshBucket(DHTable,K)
    counter++
   
  
      console.log("Connected to peer1:"+client.remotePort +" at timestamp " +singleton.getTimestamp());
      client.write(peer.address().port.toString(), 'utf8')
    
    });
  //unpacks the packet buffer
    client.on("data", function(data) { 
  
      let version = parseBitPacket(data, 0, 4)
      console.log(version)
      let peers =[]
      
      
      if(version==7){
      
        let peerIPV4 =[];
        let peerIPV4Offset = parseBitPacket(data,20,12)*8+32;
        for(let i=0; i<parseBitPacket(data,12,8); i++){
                //Applying offset here
                peerIPV4[0]=parseBitPacket(data,peerIPV4Offset,8);
                peerIPV4[1]=parseBitPacket(data,peerIPV4Offset+8,8);
                peerIPV4[2]=parseBitPacket(data,peerIPV4Offset+16,8);
                peerIPV4[3]=parseBitPacket(data,peerIPV4Offset+24,8);
          let peerIP=peerIPV4[0]+"."+peerIPV4[1]+"."+peerIPV4[2]+"."+peerIPV4[3]

          let peerPort = parseBitPacket(data,peerIPV4Offset,16)
          peerIPV4Offset+=16
          let id = singleton.getPeerID(peerIP, peerPort)
          peers[i] = {host: peerIP,port: peerPort,peerID: id}
          K[counter]=peers[i]
          counter++
        }
        
let fileName=[]
        //returns an integer array of file name to be changed to string 
        for (let i=0; i<parseBitPacket(data,20,12); i++)
          fileName[i]=parseBitPacket(data,32+i*8,8);
        
        console.log("Received Welcome message from " + bytesToString(fileName))//parseBitPacket(data,32,32))
        console.log("along with DHT: ")
        for(i in peers){
        console.log("["+peers[i].host+":"+peers[i].port+","+peers[i].peerID+"]")
        }

        console.log("Refresh k-Bucket operation is performed")
        refreshBucket(DHTable,K)

        console.log("My DHT: ")
  
        for(i in DHTable){
          !(typeof DHTable[i]==='undefined') ? console.log("["+DHTable[i].host+":"+DHTable[i].port+", "+DHTable[i].peerID+"]") : null
        }

        sendHello(DHTable,client)
        client.destroy()
      }
    });
}








let folder = require("path")
      .dirname(require.main.filename)
      .split(path.sep)
      .pop()
  console.log("This peer address is "+HOST+":"+peer.address().port+" located at "+folder+" ["+singleton.getPeerID(HOST, peer.address().port)+"]");

    peer.on("connection", function(sock) {
      singleton.setSenderName(folder)
      handler.handleClientJoining(sock);
    });

});

function refreshBucket(T, K){
  for(let i=0; i<K.length; i++){
    handler.pushBucket(T,K[i])
  }
  
}

function parseBitPacket(packet, offset, length) {
  let number = "";
  for (var i = 0; i < length; i++) {
    // let us get the actual byte position of the offset
    let bytePosition = Math.floor((offset + i) / 8);
    let bitPosition = 7 - ((offset + i) % 8);
    let bit = (packet[bytePosition] >> bitPosition) % 2;
    number = (number << 1) | bit;
  }
  return number;
}

function bytesToString(array) {
  var result = "";
  for (var i = 0; i < array.length; ++i) {
      result += String.fromCharCode(array[i]);
  }
  return result;
}

function sendHello(T, client){
  console.log("Hello packet has been sent.")
  for (i in T)
  client.connect(T[i].port, T[i].host, function () {
    client.write(p2p.getPacket(singleton.getSenderName(), T, 2))
  })
  
}



