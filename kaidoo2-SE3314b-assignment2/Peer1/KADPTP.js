let p2p = require('./cP2PPacket')
let singleton = require('./Singleton');
let cNo;
let fs = require("fs")
let DHT=[];
let serverPort;


module.exports = {

    handleClientJoining: function (sock) {
        let senderPort; 
        let peerInfo;
        serverPort = sock.address().port
        sock.on("data", function (data) {
            senderPort = data.toString();
            peerInfo={host: '127.0.0.1', port: senderPort, peerID: singleton.getPeerID('127.0.0.1',senderPort)}
            console.log(peerInfo)
    
            sock.write(p2p.getPacket(singleton.getSenderName(), DHT, 1));//call ITPResponse for packet and send to client
            pushBucket(DHT, peerInfo) 
            console.log(DHT)
            console.log("Connected from peer "+'127.0.0.1:'+senderPort)   
        
        })

         
    
    },
    pushBucket: function (T, P){
        let p = singleton.getPeerID(P.host,P.port)
        console.log("--------------------------------------")
        
        let pBin = singleton.Hex2Bin(p)
        console.log(pBin)
    let pNaught = singleton.getPeerID('127.0.0.1',serverPort)
   
    let pNaughtBin = singleton.Hex2Bin(pNaught)
    console.log(pNaughtBin)
    let n = 0;
    console.log("P: "+pBin)
    console.log("PNaight: "+pNaughtBin)
  
    for(let i=0; i<pBin.length; i++){
        if(pBin[i]!=pNaughtBin[i])
            break
        n++;
        
    }
    
    if(T[n]==undefined){
        T[n]=P;
    }else{
        console.log("*********************")
    console.log(T[n].peerID)
        if(singleton.XORing(pBin,pNaughtBin)<singleton.XORing(pBin,singleton.Hex2Bin(T[n].peerID))){
            T[n]=P;
        }
        
    }
    }
};


//// Some usefull methods ////
// Feel free to use them, but DON NOT change or add any code in these methods.

// Returns the integer value of the extracted bits fragment for a given packet
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

// Prints the entire packet in bits format
function printPacketBit(packet) {
    var bitString = "";

    for (var i = 0; i < packet.length; i++) {
        // To add leading zeros
        var b = "00000000" + packet[i].toString(2);
        // To print 4 bytes per line
        if (i > 0 && i % 4 == 0) bitString += "\n";
        bitString += " " + b.substr(b.length - 8);
    }
    console.log(bitString);
}

function pushBucket(T, P){
    let p = singleton.getPeerID(P.host,P.port)
    let pBin = singleton.Hex2Bin(p)
    let pNaught = singleton.getPeerID('127.0.0.1',serverPort)
    let pNaughtBin = singleton.Hex2Bin(pNaught)
    console.log(pBin)
    console.log(pNaughtBin)
    let n = 0;
  
    for(let i=0; i<pBin.length; i++){
        if(pBin[i]!=pNaughtBin[i])
            break
        n++;
        
    }
    if(!(typeof T[n]==='undefined')){
        if(singleton.XORing(pBin,pNaughtBin)<singleton.XORing(pBin,singleton.Hex2Bin(T[n]))){
            T[n]=P;
        }
    }else{
        T[n]=P;
    }
  }

// Converts byte array to string
function bytesToString(array) {
    var result = "";
    for (var i = 0; i < array.length; ++i) {
        result += String.fromCharCode(array[i]);
    }
    return result;
}
