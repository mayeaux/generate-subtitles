const express = require("express");
const router = express.Router();

const { getAllDirectories, getMatchingFiles } = require("./../lib/files"); 
const path = require('path');
const process = require("process");
const fs = require('fs');
const moment = require('moment');
const _ = require("lodash");

// info about transcription from files: processing_data.json
class TranscriptionInfo{
    static from(json){
        return Object.assign(new TranscriptionInfo(), json);
    }
}

async function getTranscriptionInfo(dir){
    const transcInfoFile = path.join(
        dir, 'processing_data.json'
    );
    return new Promise((resolve, reject) => {
        fs.readFile(transcInfoFile, (err, data) => {
            if(err){
                reject(err);
            }
            resolve(TranscriptionInfo.from(JSON.parse(data)));
        });
    });
}

// class to represent basic per period stats for showing on frontend
class TranscriptionStat{
    constructor(transcriptionsCount=0, timeTranscribed=0) {
        this.transcriptionsCount = transcriptionsCount;
        this.timeTranscribed = timeTranscribed;
    }
}

class TranscriptionStatPerPeriod{
    constructor(){
        this.total = new TranscriptionStat();
        this.last30days = new TranscriptionStat();
        this.last7days = new TranscriptionStat();
        this.last24h = new TranscriptionStat();
    }
}

class TranscriptionFullStats{
    constructor(){
        this.allTranscriptionPerPeriod = new TranscriptionStatPerPeriod();
        // JSON -> key is language, value is TranscriptionStatPerPeriod
        this.languagesPerPeriod = {};
    }
}

function addPeriodStatistic(transcStatPerPeriod, transcInfo){
    const finishedAtDate = new Date(transcInfo.finishedAT);
    const thisMoment = moment().toDate();
    // convert time diff to hours
    let timeDiff = thisMoment.getTime() - finishedAtDate.getTime();
    timeDiff /= (1000.0 * 60 * 60);
    const timeTranscribedForTrancription = parseInt(transcInfo.processingSeconds, 10);
    // fill per period details
    const hoursInDays = 24;
    if (timeDiff <= hoursInDays){
        transcStatPerPeriod.last24h.transcriptionsCount++;
        transcStatPerPeriod.last24h.timeTranscribed += timeTranscribedForTrancription;
    }
    if (timeDiff <= hoursInDays * 7){
        transcStatPerPeriod.last7days.transcriptionsCount++;
        transcStatPerPeriod.last7days.timeTranscribed += timeTranscribedForTrancription;
    }
    if (timeDiff <= hoursInDays * 30){
        transcStatPerPeriod.last30days.transcriptionsCount++;
        transcStatPerPeriod.last30days.timeTranscribed += timeTranscribedForTrancription;
    }
    transcStatPerPeriod.total.transcriptionsCount++;
    transcStatPerPeriod.total.timeTranscribed += timeTranscribedForTrancription;
}

function addLanguageStatistic(transcFullStat, transcInfo){
    // fill language details
    if(transcFullStat.languagesPerPeriod[transcInfo.language] == undefined){
        transcFullStat.languagesPerPeriod[transcInfo.language] = new TranscriptionStatPerPeriod();
    }
    addPeriodStatistic(transcFullStat.languagesPerPeriod[transcInfo.language], transcInfo)
}


function arrangeTranscriptionStats(transcriptionInfos){
    let transcStats = new TranscriptionFullStats();
    
    transcriptionInfos.forEach(tInfo => {
        addPeriodStatistic(transcStats.allTranscriptionPerPeriod, tInfo);
        addLanguageStatistic(transcStats, tInfo);
    });

    return transcStats;
}


router.get("/stats", async function(req, res, next){
    const baseTranscDir = path.join(process.cwd(), '/transcriptions');
    let transcriptionDirs = await getAllDirectories(baseTranscDir);
    let transcriptionInfos = [];
    for (let i = 0; i < transcriptionDirs.length; i++){
        let transcInfo = await getTranscriptionInfo(
            path.join(
                baseTranscDir, transcriptionDirs[i].name
            )
        );
        
        transcriptionInfos.push(transcInfo);
    }
    arrangedTranscStats = arrangeTranscriptionStats(transcriptionInfos);

    console.log(`Transc infos: ${JSON.stringify(arrangedTranscStats)}`);

    return res.render("stats", {
        // list of file names
        arrangedTranscStats: arrangedTranscStats,
        title: "Stats"
    });
});

module.exports = router;