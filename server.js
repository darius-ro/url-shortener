require("dotenv").config({ quiet: true })
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/";

var express = require("express"),
  app = express();

var hbs = require("hbs");

var mongoose = require("mongoose");
var randomstring = require("randomstring");

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch((err) => {
        console.log(err);
        console.log("Failed to connect to MongoDB");
    });

var urlSchema = mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    link: {
        type: String,
        required: true
    },
    views: {
        type: Number,
        default: 0
    },
});

var urlModel = mongoose.model('url', urlSchema);

app.engine('.hbs', hbs.__express);
app.set('view engine', '.hbs');
app.use(express.json({limit:"1kb"}));
app.use("/_public", express.static("public"))

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});

app.get("/", (req, res) => {
    res.render("index");
})

app.post("/", async (req, res, next) => {
    const url = req.body.url
    if (typeof url !== "string") return next(); // If url is not a string, send them away.
    const id = url.split("/").at(-1)
    if (id && id.length == 9) { // Possible shortened url
        const match = await urlModel.findOne({ id, })
        if (match) { // Shortened url found.
            return res.status(200).json({
                views: match.views,
            })
        }
    }

    // Create shortened url
    new urlModel({
        id: randomstring.generate({
            length: 9
        }),
        link: url
    })
        .save()
        .then((result) => {
            return res.status(200).json({
                url: result.id
            })
        })
        .catch((err) => {
            console.log(err);
            return res.status(500).json({
                error: "A internal server error has occured."
            })
        })
})

app.get("/_views/:id", async (req,res) => { // I added this because I thought I might use it, ended up not wanting to...
    let id = req.params.id;
    let url = await urlModel.findOneAndUpdate({ id, });

    if (!url) return res.status(404).json({
        error: "This url doesn't exist."
    });

    return res.status(200).json({
        views: url.views,
    });
})

app.get("/:id", async (req, res, next) => {
    let id = req.params.id;
    let url = await urlModel.findOneAndUpdate({ id, }, { $inc: { views: 1 } });

    if (!url) return next();

    return res.status(200).redirect(url.link);
})

app.use((req, res, next) => {
    if (!res.headersSent)
        return res.status(404).render("404");
})

app.use((err, req, res, next) => {
    if (err) {
        res.status(500).send("A internal server error occured, please try again later.");
        console.log(err);
    };
})