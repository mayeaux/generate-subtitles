const express = require("express");
const router = express.Router();
const { arrangeTranscriptionStats, getAllTranscriptionsInfos } = require("../lib/statslibs/functions");

router.get("/stats", async function(req, res, next){
    let transcriptionInfos = await getAllTranscriptionsInfos();
    arrangedTranscStats = arrangeTranscriptionStats(transcriptionInfos);
    return res.render("stats", {
        // list of file names
        arrangedTranscStats: arrangedTranscStats,
        title: "Stats"
    });
});

module.exports = router;