// IMPORTS
const express = require('express');
const cors = require('cors');
const Filter = require('bad-words');
const rateLimit = require('express-rate-limit');
const monk = require('monk');

// CALLS
const app = express();
const filter = new Filter();
app.use(cors());
app.use(express.json());
// changed localhost/deer to database name
const db = monk('localhost/deer');
const posts = db.get('posts');
const comments = db.get('comments')
const admins = db.get('admins')

// FUNCTIONS
function validate(package) {
	if (package.uid.toString().trim() == '') {
		return 'guest';
	}
	if (package.content.toString().trim().length < 10) {
		return 'short_content';
	}
	return 'good';
}

function getList(json_list) {
	var list = []
	for (var i in json_list) {
		list.push(json_list[i])
	}
	return list
}

// POST called in client.js:82
app.post('/delete', (req, res) => {
	posts.findOneAndDelete({ _id: req.body._id })
		// .then(doc => { res.json({ message: 'Post ' + req.body._id + ' removed.' }) })

	comments.findOneAndDelete( { pid: req.body._id})

	res.json({ message: req.body._id + ' deleted.' })
})

// POST called in client.js:82
app.post('/cool', (req, res) => {
	const me = req.body.me
	const uid = req.body.post.uid
	const _id = req.body.post._id
	const likes = getList(req.body.post.likesFrom)
	const mehs = getList(req.body.post.mehsFrom)

	if (uid == me) {
		res.status(406)
		res.json({ message: 'own_post' })
	}
	else if (likes.includes(me)) {
		res.status(406)
		res.json({ message: 'already' })
	} else {
		likes.push(me)
		if (mehs.includes(me))
			mehs.splice(mehs.indexOf(me), 1)
		posts.findOneAndUpdate({ _id: req.body.post._id }, { $set: { likesFrom: likes, mehsFrom: mehs } })
		res.status(200)
		res.json({ message: 'updated' })
	}
});

app.post('/meh', (req, res) => {
	const me = req.body.me
	const uid = req.body.post.uid
	const _id = req.body.post._id
	const likes = getList(req.body.post.likesFrom)
	const mehs = getList(req.body.post.mehsFrom)

	if (uid == me) {
		res.status(406)
		res.json({ message: 'own_post' })
	}
	else if (mehs.includes(me)) {
		res.status(406)
		res.json({ message: 'already' })
	} else {
		mehs.push(me)
		if (likes.includes(me))
			likes.splice(likes.indexOf(me), 1)
		posts.findOneAndUpdate({ _id: req.body.post._id }, { $set: { likesFrom: likes, mehsFrom: mehs } })
		res.status(200)
		res.json({ message: 'updated' })
	}
});

// GET Called in client.js:83
app.get('/posts', (req, res) => {
	posts.find().then((posts) => {
		res.json(posts);
	});
});

app.post('/comment', (req, res) => {
	if (req.body.content.length < 10){
		res.statusCode = 411
		res.json({message: 'Length too short, minimum 10 chars!'})
		return
	}
	
	const package = {
		pid: req.body.pid,
		comments: [{
			content: req.body.content,
			uid: req.body.uid
		}]
	}

	comments.find({ pid: req.body.pid }).then(result => {
		if (result.length == 0) {
			comments.insert(package)
		}
		else {
			var comment_list = []
			comment_list = result[0].comments
			comment_list.push(package.comments[0])
			comments.findOneAndUpdate({ pid: req.body.pid }, { $set: { comments: comment_list } })
			comment_list = []
		}
	})
	req.statusCode = 200
	res.json('done')
})

app.get('/allcomments', (req, res) => {
	comments.find().then(response => {
		res.json(response)
	})
})

app.get('/comments', (req, res) => {
	if (!req.query.pid) {
		res.json('Querry parameter not found.')
		return
	}
	comments.find({ pid: req.query.pid }).then((coms) => {
		if (coms.length > 0)
			res.json(JSON.stringify(coms[0].comments));
		else
			res.json([])
	});
})

app.post('/addadmin', (req, res) => {
	// get the list of admins
	console.log(req.body.uid)
	admins.find().then(obj => {
		// get the list
		var ads = obj[0].admins
		// check if the recieved uid is inside the admins list

		var isin = false
		for (var i in ads)
			if (ads[i] == req.body.uid) {
				isin = true
				break
			}

		if (!isin){
			ads.push(req.body.uid)
			admins.findOneAndUpdate( { _id: '5ef356f04594403ddc8a840c'}, { $set: { admins: ads}})
			res.json('added')
		} else {
			res.json('already')
		}
	})

	// admins.insert({ admins: ['GJ4SsXQF9IfVyirXiaKe2L8nwJa2'] }).then(inserted => {
	// 	console.log('nice')
	// })
})

app.post('/isadmin', (req, res) => {
	admins.find().then(object => {
		var list = object[0].admins

		var isAdmin = false
		for (var i in list)
			if (list[i] == req.body.uid){
					isAdmin = true
					break
				}
		// ASK: console.log(req.body.uid in object[0].admins)
		res.json(isAdmin)		
	})
})

app.get('/admins', (req, res) => {
	admins.find().then(obj => {
		res.json(obj[0].admins)
	})
})

app.get('/', (req, res) => {
	res.send('App running! Congrats! You good!')
})

// We want to limit only the post requests
app.use(
	rateLimit({
		windowMs: 10 * 1000, //in ms, so 1 minute between requests
		max: 1
	})
);

// POST Called in client.js:96
app.post('/post', (req, res) => {
	switch (validate(req.body)) {
		case 'good':
			const package = {
				uid: req.body.uid.toString(),
				// content: filter.clean(req.body.content.toString()),
				content: req.body.content.toString(),
				likesFrom: req.body.likesFrom,
				mehsFrom: [],
				created: new Date()
			};
			posts.insert(package).then((createdPost) => {
				res.json(createdPost);
			});
			break;
		case 'guest':
			res.status(422);
			res.json({ message: "Guest can't post." });
			break;
		case 'short_content':
			res.status(422);
			res.json({ message: 'Content too short.' });
			break;
		default:
			res.status(500);
			res.json({ message: 'Somthing failed.' });
	}
});

const server = app.listen(process.env.PORT || 8080, () => {
	const host = server.address().address
	const port = server.address().port

	console.log(`App listening at http://${host}:${port}`)
});

// posts.findOneAndDelete({_id: req.body._id}).then(doc => { res.json({message: 'Post ' + req.body._id + ' removed.'}) })