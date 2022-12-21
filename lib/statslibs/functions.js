const fs = require('fs');
const moment = require('moment');
const _ = require("lodash");
const path = require('path');
const { TranscriptionStatPerPeriod, TranscriptionFullStats, TranscriptionInfo } = require('./models');
const { getAllDirectories } = require('../files');

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

async function getAllTranscriptionsInfos(){
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
    return transcriptionInfos;
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

module.exports = {
    getTranscriptionInfo,
    getAllTranscriptionsInfos,
    addPeriodStatistic,
    addLanguageStatistic,
    arrangeTranscriptionStats
}