let fs = require('fs');
const { isIPv4 } = require('net');
let singleton = require('./Singleton')

module.exports = {

    getPacket: function (senderName, DHTable, message) {

        let numberOfPeers = 0; 
        let peerPort = 0;
        
        //Constructing the DHT Table 
        if(DHTable.length){
            console.log("DHTTABLE")
            console.log(DHTable)
            numberOfPeers = DHTable.filter((val => val.peerID)).length
            console.log("Number Of Peers: "+numberOfPeers)
            peerPort= Array.from(DHTable.map(a => a.port));
            console.log("Port: "+peerPort)
        }
        
        //Establishing peer size
        let size=numberOfPeers*6;
        let packet = Buffer.alloc(60);
        //store version
        storeBitPacket(packet,7,0,4);
        //store welcome message
        storeBitPacket(packet,message,4,8);
        //store number of peers
        storeBitPacket(packet,numberOfPeers,12,8);
        //store length of sender name
        storeBitPacket(packet,Buffer.from(senderName).length,20,12);
        
        let sender=stringToBytes(senderName)//convert sender name to bytes form
        console.log(sender.length)

        for (let i = 0; i < sender.length; i++) {
            storeBitPacket(packet,sender[i],32+ i*8,8);//store sender name in packet
          }
          
            let num=0;
            let IPV4="127.0.0.1".split(".")
            let ipPosition = sender.length*8+32
            console.log(ipPosition)

            
             for(let i=0; i<numberOfPeers; i++){

              storeBitPacket(packet, parseInt(IPV4[0]), ipPosition, 8)
              storeBitPacket(packet, parseInt(IPV4[1]), ipPosition+8, 8)
              storeBitPacket(packet, parseInt(IPV4[2]), ipPosition+16, 8)
              storeBitPacket(packet, parseInt(IPV4[3]), ipPosition+24, 8)
                ipPosition+=4;
                while(typeof peerPort[num]==='undefined'){
                    num++
                }
                console.log("PeerPORT: "+peerPort[num])
                console.log(ipPosition)
                storeBitPacket(packet,parseInt(peerPort[num]),ipPosition,16)
                num++;
                ipPosition+=16
             }

             
        
            return packet;    
        
    },
    // sendPacket: 
};

// Store integer value into specific bit poistion the packet
function storeBitPacket(packet, value, offset, length) {
    // let us get the actual byte position of the offset
    let lastBitPosition = offset + length - 1;
    let number = value.toString(2);
    let j = number.length - 1;
    for (var i = 0; i < number.length; i++) {
        let bytePosition = Math.floor(lastBitPosition / 8);
        let bitPosition = 7 - (lastBitPosition % 8);
        if (number.charAt(j--) == "0") {
            packet[bytePosition] &= ~(1 << bitPosition);
        } else {
            packet[bytePosition] |= 1 << bitPosition;
        }
        lastBitPosition--;
    }
}

function stringToBytes(str) {
    var ch,
      st,
      byteArray = [];
    for (var i = 0; i < str.length; i++) {
      // get char
      ch = str.charCodeAt(i); 
      // set up "stack"
      st = []; 
      do {
        // pushes the byte to stack
        st.push(ch & 0xff); 
        // shift value down by 1 byte
        ch = ch >> 8; 
      } while (ch);
      // adds the stack contents to result and doen because chars has wrong endianness 
      byteArray = byteArray.concat(st.reverse());
    }
    return byteArray;
  }
  function missing(array){
      let newArr
      let counter = 0;
    for(i in array){
        if(array[i]!="")
        newArr[counter]=array[i]
    }
    return newArr
  }

  function parseBitPacket(packet, offset, length) {
    let number = "";
    for (var i = 0; i < length; i++) {
      // getting the actual byte position of the offset
      let bytePosition = Math.floor((offset + i) / 8);
      let bitPosition = 7 - ((offset + i) % 8);
      let bit = (packet[bytePosition] >> bitPosition) % 2;
      number = (number << 1) | bit;
    }
    return number;
  }
  