var express = require('express');
var app = express();
var lastUser;

var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var database;

var bodyParser = require('body-parser');
app.use(bodyParser.json({limit: '50mb'}));
app.use(express.static(__dirname + '/'));

var fs = require('fs');


app.listen(8080, function() {

	console.log("server is listening on 8080 port");

	// Connect to the db
	MongoClient.connect("mongodb://localhost:27017/", function(err, db) {

  		if(err) {

    		console.log(err);

 	 	} else {

 	 		database = db;
 	 		//db.collection('Users').drop();
 	 		db.createCollection('Users', function(err,collection){

 	 			if(err){

 	 				console.log(err);

 	 			} else {

 	 				console.log("Users database created successfully");
 	 			}

 	 		});

 	 	}

	});

});


//ping test
app.get('/', function(req,res){


	res.sendfile('Portfolio.html');


});

//get info of joined groups
//payload {"groups" : []}
app.post('/getJoinedGroups', function(req,res){


	var groups = req.body.groups;

	var groupsToFind = [];
	console.log("groups to find are" + groups.length);
	for(var i=0; i<groups.length; i++) {

		var group = {

			$elemMatch : {"id" : ObjectID(groups[i])}
		};

		groupsToFind.push(group);

	}

	console.log(groupsToFind);

	var collection =  database.collection("Users");


	collection.findOne({group : {$all: groupsToFind}},{"group" : 1} , function(err, group){

		if(err) {

			console.log(err);

		} else if(group != null){


			res.json(group)


		} else {

			res.json({result: "fail"});
		}


	});


});

//1
//get photos and videos of particular group
//payload {"id" : <grpId>}
app.post('/getGroupMedia', function(req,res){

	var collection =  database.collection("Users");
	console.log(req.body.id)

	if(!/[a-f0-9]{24}/.test(req.body.id)) {

       res.json({"result": "fail"});

    } else {

    	collection.findOne({group : {$elemMatch : {id : ObjectID(req.body.id)}}},{ "group.$": 1 }, function(err, group){

		//console.log(group);
			if(err) {

				console.log(err);

			} else if(group != null){


				res.json(group);

			} else {

				res.json({result: "fail"});
			}


		});

    }

});


//2
//get info of particular user
//payload {"username": <username>}
app.post("/getInfo", function(req,res){

	var collection =  database.collection("Users");
	collection.findOne({username: req.body.username} , function(err, user){

		if(err) {

			console.log(err);
			res.json({result: "fail"});

		} else if(user != null){

			res.json(user);

		} else {

			res.json({result: "fail"});
		}

	});

});


//change the profile
app.post("/changeProfile", function(req,res){

	var collection =  database.collection("Users");
	collection.findOne({username : req.body.username}, function(err,doc){


		if(err) {

			console.log(err);

		} else {


			if(doc == null) {

				res.json({result: "fail"});

			} else {


				if(req.body.profileImage) {

					fs.writeFile(doc.filePath,req.body.profileImage,'binary',function(err){

						if(err) {

							console.log(err);

						} else {


						}
					});

				 }

				var updatedProfile = {

					timeStamp : doc.timeStamp,
					profileImage : doc.filePath,
					name : req.body.name,
					username : req.body.username,
					password : req.body.password,
					email : req.body.email,
					group : doc.group,
					joinedGroups : doc.joinedGroups

				}

				collection.update({_id: doc._id}, updatedProfile, function(err,result){

					if(err) {

						console.log(err);
						res.json({"result": "fail"});

					} else {

						res.json({result: updatedProfile});
					}
				});

			}
		}


	});

});


//3(a)
//upload image to particular group
//payload {image: <data>, id: <groupId>, owner: <userId>, thumbnail: <Thumbnail>}
app.post("/uploadImage", function(req,res){


		var base64Data = req.body.image.replace(/^data:image\/png;base64,/, "");
		var base64DataForThumbNail = req.body.thumbnail.replace(/^data:image\/png;base64,/, "");
		//console.log(base64Data);

		var buf = new Buffer(base64Data, 'base64');
		var thumbnailBuf = new Buffer(base64DataForThumbNail,'base64');
		var filePath = new ObjectID() +".png";
		var thumbnailPath = new ObjectID() + ".png";

		fs.writeFile(filePath,buf,function(err){

			if(err) {

				console.log(err);
				res.json({result: "fail"});

			} else {

				fs.writeFile(thumbnailPath,thumbnailBuf,function(err){

					if(err) {

						console.log("thumbnail saving err" + err);
						res.json({result: "fail"});

					} else {


						console.log("image saved");
						var collection =  database.collection("Users");

						collection.findOne({group : {$elemMatch : {id : ObjectID(req.body.id)}}}, function(err, user){

							if(err) {

								console.log(err);
								res.json({"result" : "fail"});

							} else if(user != null) {

								var groups =  user.group;

								for(var i=0; i<groups.length; i++) {

									if(groups[i].id == req.body.id) {

										var newImage = {

											path : filePath,
											type : "image",
											orientation : req.body.orientation,
											thumbnail : thumbnailPath,
											timeStamp : new Date(),
											owner : req.body.owner
										}

										groups[i].media.push(newImage);

									}

								}

								collection.update({_id: user._id},{$set: {group: groups}}, function(err,result){

									if(err) {

										console.log(err);
										res.json({"result" : "fail"});

									} else {

										res.json({"result": user});
									}

								});

							}
				       });
					}

				})

			}

		});

	});


//3(b)
//upload video to partcular group
//payload {video: <data>, id: <groupId>, owner: <userId>, thumbnail: <Thumbnail>}
app.post("/uploadVideo", function(req,res){

	var filePath = new ObjectID() +".mp4";
	var buf = new Buffer(req.body.video, 'base64');
	var base64DataForThumbNail = req.body.thumbnail.replace(/^data:image\/png;base64,/, "");
	var thumbnailBuf = new Buffer(base64DataForThumbNail,'base64');
	var thumbnailPath = new ObjectID() + ".png";


	fs.writeFile(filePath,buf,function(err){

		if(err) {

			console.log(err);
			res.json({result: "fail"});

		} else {

			fs.writeFile(thumbnailPath,thumbnailBuf,function(err){

				if(err) {

					console.log("thumbnail saving err" + err);
					res.json({result: "fail"});

				} else {

					console.log("video saved");
					var collection =  database.collection("Users");

					collection.findOne({group : {$elemMatch : {id : ObjectID(req.body.id)}}}, function(err, user){

						if(err) {

							console.log(err);
							res.json({"result" : "fail"});

						} else if(user != null) {

							var groups =  user.group;

							for(var i=0; i<groups.length; i++) {

								if(groups[i].id == req.body.id) {

									var newVideo = {

										path : filePath,
										type : "video",
										thumbnail : thumbnailPath,
										timeStamp : new Date(),
										owner : req.body.owner
									}

									groups[i].media.push(newVideo);

								}

							}

							collection.update({_id: user._id},{$set: {group: groups}}, function(err,result){

								if(err) {

									console.log(err);
									res.json({"result" : "fail"});

								} else {

									res.json({"result": user});
								}

							});

						}
		   			});

				}

			})

		}
	});

});


//joinGroup
//payload {"username" : <>, "groupId" : <>}
//response {"result" : groupObject}
app.post('/joinGroup', function(req, res){

	var username = req.body.username;
	var groupId = req.body.groupId;

	if(!/[a-f0-9]{24}/.test(groupId)) {

       res.json({"result": "fail"});
    }


	console.log(username + "---" + groupId);

	var collection =  database.collection("Users");
	collection.findOne({group : {$elemMatch : {id : ObjectID(groupId)}}}, function(err, user){

		if(err) {

			console.log("hey error occurred:" + err);
			res.json({"result" : "fail"});

		} else if(user != null) {


			collection.findOne({username: username}, function(err,member){


				if(err) {

					console.log(err);
					res.json({"result" : "fail"});

				} else if(member != null) {

					var joinedGroups = member.joinedGroups;

					if(joinedGroups.indexOf(groupId) > -1){

						console.log("already joined the group");
						res.json({"result" : "fail"});

					} else {

						joinedGroups.push(groupId);
						console.log(joinedGroups)
						collection.update({_id: member._id}, {$set: {joinedGroups: joinedGroups}}, function(err,result){

							if(err) {

								console.log(err);
								res.json({"result" : "fail"});

							} else {


								var group = user.group;
								for(var i=0; i<group.length; i++) {

									if(group[i].id == groupId) {

										console.log(group[i]);
										group[i].members.push(member.username);

										collection.update({_id: user._id}, {$set: {group: group}}, function(err, result){

												if(err) {

													console.log(err);
													res.json({"result" : "fail"});


												} else {

													collection.findOne({username: req.body.username}, function(err,updatedMember){

															if(err) {

																console.log(err);
																res.json({"result" : "fail"});

															} else {

																res.json({"result" : updatedMember});

															}

													});

												}

										});
										break;

									}
								}


							}


						});


				}




				} else {

					console.log("member not found");
					res.json({"result": "fail"});
				}



			});



		} else {

			console.log("user having that group not found");
			res.json({"result" : "fail"});

		}

	});



});

// //4
// //accept or deny the request to join the group
// app.post("/responseToRequest", function(req,res){

// 	var collection =  database.collection("Users");
// 	if(req.body.confirmation === "yes") {

// 		console.log(req.body.id);
// 		collection.findOne({group : {$elemMatch : {id : ObjectID(req.body.id)}}}, function(err, user){

// 			if(err) {

// 				console.log(err);
// 				res.json({"result" : "fail"});

// 			} else if(user != null) {

// 					var groups =  user.group;

// 					for(var i=0; i<groups.length; i++) {

// 					if(groups[i].id == req.body.id) {

// 							groups[i].members.push(req.body.username);
// 							break;
// 						}

// 					}

// 					collection.update({_id: user._id}, {$set : {group: groups}}, function(err, result){

// 						if(err) {

// 							console.log(err);
// 							res.json({"result": "fail"});

// 						} else {

// 							console.log(result);
// 						}

// 					});

// 					collection.findOne({username: req.body.username}, function(err, user){

// 						if(err) {

// 							console.log(err);
// 							res.json({"result": "fail"});

// 						} else {


// 							var joinedGroups = user.joinedGroups;
// 							joinedGroups.push(req.body.id);
// 							collection.update({_id: user._id}, {$set: {joinedGroups: joinedGroups}}, function(err,result){

// 								if(err) {

// 									console.log(err);
// 									res.json({"result": "fail"});

// 								} else {

// 									res.json(user);
// 								}


// 							});
// 						}

// 					});

// 			}



// 		});


// 	}

// 	collection.findOne({username: req.body.username}, function(err, user){

// 		if(err) {

// 			console.log(err);
// 			res.json({"result": "fail"});

// 		} else if(user != null) {

// 			var pendingRequests = user.pendingRequests;
// 			pendingRequests.splice(pendingRequests.indexOf(req.body.id));
// 			collection.update({_id: user._id}, {$set: {pendingRequests: pendingRequests}}, function(err,result){

// 				if(err) {

// 					console.log(err);

// 				} else {

// 					if(req.body.confirmation === "no")
// 					res.json(user);
// 				}
// 			});

// 		} else {

// 			res.json({"result": "fail"});
// 		}
// 	});

// });

//5
//create a new group
//payload {"username" : <> , "groupName" : <>}
app.post("/createGroup", function(req,res){

	var collection =  database.collection("Users");
	collection.findOne({username : req.body.username}, function(err,doc){

		if(err) {

			console.log(err);
			res.json({"result": "fail"});

		} else if(doc != null){

			//console.log(doc);
			var groups = doc.group;
			var joinedGroups = doc.joinedGroups;
			var groupId = new ObjectID();

			var newGroup = {

				id: groupId,
				timeStamp : new Date(),
				creator : doc.username,
				name : req.body.groupName,
				members : [],
				media : []

			};

			groups.push(newGroup);
			joinedGroups.push(groupId.toString());
			console.log(joinedGroups);
			collection.update({_id:doc._id},{$set : {group : groups, joinedGroups: joinedGroups}}, function(err, result){

				if(err) {

					console.log(err);
					res.json({"result": "fail"});

				} else {

					res.json({"result":doc});

				}

			});

		} else {

			res.json({result:"fail"});
		}


	});


});


// //6
// //request to join group
// app.post("/requestToJoinGroup", function(req,res){

// 	console.log(req.body.requestee + "--" + req.body.requester + "--" + req.body.groupName);
// 	var collection =  database.collection("Users");
// 	collection.findOne({username : req.body.requestee}, function(err,user){

// 		if(err) {

// 			console.log(err);

// 		} else if(user != null) {


// 			console.log(user);
// 			var requests = user.pendingRequests;

// 			collection.findOne({group : {$elemMatch : {name : req.body.groupName, creator: req.body.requester}}}, function(err,requester){

// 				if(err){

// 					console.log(err);
// 					res.json({"result": "fail"});

// 				} else {

// 					var groups = requester.group;
// 					for(var i=0; i<groups.length; i++) {

// 						if(groups[i].name == req.body.groupName) {

// 							requests.push(groups[i].id);
// 						}

// 					}

// 					collection.update({_id : user._id}, {$set: {pendingRequests : requests}}, function(err, response){

// 							if(err) {

// 								console.log(err);
// 								res.json({"result": "fail"});

// 							} else {

// 								res.json(user);
// 							}

// 					});


// 				}

// 			});

// 		} else {

// 			res.json({result:"fail"});
// 		}


// 	});

// })



//7
//search for a user to add in a group by usename
app.post('/search', function(req,res){

	//console.log(req.body.searchword);
	var collection =  database.collection("Users");
	collection.findOne({username : req.body.searchword}, function(err,doc){

		if(err) {

			console.log(err);

		} else {

			if(doc == null) {

				res.json({result:"not found!"});

			} else {


				res.json({result:doc});

			}
		}


	});

});


//8
//login endpoint
// payload {username: "" , password : ""}
// response {result: "success" or "failure"}
app.get('/logout', function(req,res) {

	res.json({result:"ok"});

});

app.post('/login',function(req,res){


	var collection =  database.collection("Users");
	collection.findOne({username : req.body.username, password: req.body.password}, function(err,doc){

		if(err) {

			console.log(err);
			res.json({result:"fail"});


		} else {

			if(doc == null) {

				res.json({result:"fail"});

			} else {

				//console.log("user in session " + app.session.user);
				res.json({result: doc});

			}
		}


	});


});


//9
//signin endpoint
//payload {name :"", username: "", password: "", email: ""}
//reponse {result: ""}
app.post('/signin', function(req,res){


	var collection =  database.collection("Users");
	collection.findOne({username : req.body.username}, function(err,doc){


		if(err) {

			console.log(err);

		} else {


			if(doc == null) {

				var filePath = new ObjectID() +".png";
				console.log("the filePath for profile image is : " + filePath);

				if(req.body.profileImage) {


					fs.writeFile(filePath,eeq.body.profileImage,'binary',function(err){

						if(err) {

							console.log(err);

						} else {


						}
					});

				 }

				var doc = {

					timeStamp : new Date(),
					profileImage : filePath,
					name : req.body.name,
					username : req.body.username,
					password : req.body.password,
					email : req.body.email,
					group : [],
					joinedGroups : []

				}

				collection.insert(doc, function(err,result){

					if(err) {

						console.log(err);
						res.json({"result": "fail"});

					} else {

						res.json({result: result});
					}
				});

			} else {

				res.json({result: "fail"});
			}
		}


	});


});
