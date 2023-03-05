let timestamp, peerNo, sender
let port = [];
peerNo = 0;
let numOfPeers = 0,
senderName,
portNumber;

module.exports = {
  init: function() {
    timestamp = Math.floor(Math.random() * (999 - 1) + 1);
    setInterval(function() {
      return timestamp;
    }, 10);
  },

  getTimestamp: function() {
    return timestamp;
  },
  getPeerID: function (IP, port) {
    var crypto = require('crypto')
    var sha1 = crypto.createHash('sha1')
    sha1.update(IP + ':' + port)
    return sha1.digest('hex')
  }, //numPeers, senderLength, senderName, port
  setNumPeers: function (){
    numOfPeers++;
  }, 
  getNumPeers: function (){
    return numOfPeers;
  },
  setSenderName: function (name){
    senderName=name
  },
  getSenderName: function (){
    return senderName
  },
  setPort: function(port){
    portNumber=port
  },
  getPort: function (){
    return portNumber;
  },  
  XORing: function (a, b){
    let ans = "";
        for (let i = 0; i < a.length ; i++)
        {
            // If the Character matches
            if (a[i] == b[i])
                ans += "0";
            else
                ans += "1";
        }
        return ans;
    },
    Hex2Bin: function (hex) {
      var bin = ""
      hex.split("").forEach(str => {
          bin += parseInt(str, 16).toString(2).padStart(8, '0')
      })
      return bin
  }
};
