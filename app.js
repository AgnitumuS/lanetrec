var widgetAPI = new Common.API.Widget(),
    tvKey = new Common.API.TVKeyValue(),
    tzOffset = -180 * 60 * 1000,
    channelListUrl = 'http://api.lanet.tv/rec/list.json',
    topProgListUrl = 'http://api.lanet.tv/rec/topProg.json',
    progListUrl = 'http://api.lanet.tv/rec/epgDay/{0}/{1}', //http://api.lanet.tv/rec/epgDay/{channel}/{YYYY-MM-DD}
    hlsUrl = 'http://api.lanet.tv/rec/play/{0}:{1}.m3u8',   //http://api.lanet.tv/rec/play/{channel}:{start}.m3u8
    avplay, yesterday, channels, programs, currentChannel, currentProgram, infoTimer, volumeTimer, programTimer;

if (!String.prototype.format) {
    String.prototype.format = function () {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] != 'undefined' ? args[number] : match;
        });
    };
}

function loadChannelList(callback) {
    var channelRequest;
    channelRequest = new XMLHttpRequest();
    channelRequest.onreadystatechange = function () {
        if (channelRequest.readyState === 4 && channelRequest.status === 200) {
            var utcDate = new Date(channelRequest.getResponseHeader('Date')),
                localDate = new Date(utcDate.getTime() + tzOffset),
                year = localDate.getFullYear().toString(),
                month = (localDate.getMonth() + 1).toString(),
                day = (localDate.getDate() - 1).toString();
            if (month.length < 2)
                month = '0' + month;
            if (day.length < 2)
                day = '0' + day;
            yesterday = year + '-' + month + '-' + day;
            channels = JSON.parse(channelRequest.responseText);
            callback(channelRequest);
        }
    };
    channelRequest.open('GET', channelListUrl, true);
    channelRequest.send();
}

function loadTopProgList(callback) {
    var topProgRequest;
    topProgRequest = new XMLHttpRequest();
    topProgRequest.onreadystatechange = function () {
        if (topProgRequest.readyState === 4 && topProgRequest.status === 200) {
            programs = JSON.parse(topProgRequest.responseText);
            callback(topProgRequest);
        }
    };
    topProgRequest.open('GET', topProgListUrl, true);
    topProgRequest.send();
}

function loadProgList(channel, date, callback) {
    var progRequest;
    progRequest = new XMLHttpRequest();
    progRequest.onreadystatechange = function () {
        if (progRequest.readyState === 4 && progRequest.status === 200) {
            programs = JSON.parse(progRequest.responseText);
            callback(progRequest);
        }
    };
    progRequest.open('GET', progListUrl.format(channel.id.toString(), date), true);
    progRequest.send();
}

function showChannel(data) {
    clearTimeout(infoTimer);
    var container = document.getElementById('channel');
    container.style.visibility = 'visible';
    if (typeof data === 'string') {
        container.innerHTML = data;
    }
    infoTimer = setTimeout(function () {
        container.style.visibility = 'hidden';
    }, 3000);
}

function showProgram(data) {
    clearTimeout(programTimer);
    var container = document.getElementById('program');
    container.style.visibility = 'visible';
    if (typeof data === 'string') {
        container.innerHTML = data;
    }
    programTimer = setTimeout(function () {
        container.style.visibility = 'hidden';
    }, 3000);
}

function showVolume() {
    clearTimeout(volumeTimer);
    var container = document.getElementById('volume');
    container.style.color = 'white';
    container.style.visibility = 'visible';
    container.innerHTML = webapis.audiocontrol.getVolume().toString();
    volumeTimer = setTimeout(function () {
        container.style.visibility = 'hidden';
    }, 3000);
}

function showMute() {
    clearTimeout(volumeTimer);
    if (webapis.audiocontrol.getMute()) {
        var container = document.getElementById('volume');
        container.style.color = 'red';
        container.style.visibility = 'visible';
        container.innerHTML = 'MUTE';
    } else {
        showVolume();
    }
}

function playChannel(channel) {
    loadProgList(channel, yesterday, function() {
        showChannel(channel.title);
        if (programs.length > 0) {
            currentProgram = 0;
            play(programs[currentProgram])
        } else {
            showProgram(Strings.programListEmpty);
            avplay.stop();
        }
    });
}

function play(prog) {
    avplay.stop();
    avplay.open(hlsUrl.format(prog.id.toString(), prog.start.toString()) + '|COMPONENT=HLS');
    avplay.play(function () {
        showProgram(prog.title);
        for (var i = 0; i < channels.length; i++) {
            if (channels[i].id === prog.id) {
                showChannel(channels[i].title);
            }
        }
    }, function (error) {
        console.error(error.message);
    });
}

function onLoad() {
    var body = document.getElementsByTagName('body')[0];
    body.onkeydown = keyDown;
    body.focus();
    widgetAPI.sendReadyEvent();
    loadChannelList(function () {
        currentChannel = -1;
        webapis.avplay.getAVPlay(function (avplayObj) {
            avplay = avplayObj;
            avplayObj.init();
            loadTopProgList(function () {
                if (programs.length > 0) {
                    currentProgram = 0;
                    play(programs[currentProgram])
                } else {
                    showChannel(Strings.programListEmpty);
                }
            });
        });
    });
}

function keyDown() {
    switch (event.keyCode) {
        case tvKey.KEY_RETURN:
            widgetAPI.sendReturnEvent();
            break;
        case tvKey.KEY_PAUSE:
            avplay.pause();
            break;
        case tvKey.KEY_PLAY:
            avplay.resume();
            break;
        case tvKey.KEY_RW:
            if (currentProgram > 0) {
                currentProgram = currentProgram - 1;
                play(programs[currentProgram]);
            }
            break;
        case tvKey.KEY_FF:
            if (currentProgram < programs.length - 1) {
                currentProgram = currentProgram + 1;
                play(programs[currentProgram]);
            }
            break;
        case tvKey.KEY_CH_DOWN:
            if (channels.length > 0) {
                if (currentChannel === -1)
                    currentChannel = 0;
                else
                    currentChannel = currentChannel > 0 ? currentChannel - 1 : channels.length - 1;
                console.log(currentChannel);
                playChannel(channels[currentChannel]);
            } else {
                showChannel(Strings.channelListEmpty);
            }
            break;
        case tvKey.KEY_CH_UP:
            if (channels.length > 0) {
                if (currentChannel === -1)
                    currentChannel = 0;
                else
                    currentChannel = currentChannel < channels.length - 1 ? currentChannel + 1 : 0;

                console.log(currentChannel);
                playChannel(channels[currentChannel]);
            } else {
                showChannel(Strings.channelListEmpty);
            }
            break;
        case tvKey.KEY_VOL_UP:
            webapis.audiocontrol.setVolumeUp();
            showVolume();
            break;
        case tvKey.KEY_VOL_DOWN:
            webapis.audiocontrol.setVolumeDown();
            showVolume();
            break;
        case tvKey.KEY_MUTE:
            webapis.audiocontrol.setMute(!webapis.audiocontrol.getMute());
            showMute();
            break;
        case tvKey.KEY_INFO:
            showChannel();
            break;
    }
}

window.onload = function () {
    var readyStateCheckInterval = setInterval(function () {
        if (document.readyState === 'complete') {
            clearInterval(readyStateCheckInterval);
            onLoad();
        }
    }, 10);
};