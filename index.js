 // Configuration
 require('dotenv').config();

 const express = require("express")
const app = express();
const port = 8080;
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');





app.use(cors());

const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);


admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://restauration-project-4c00d-default-rtdb.firebaseio.com'
  });

  app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));




app.get('/', (req, res) => {
  res.send('Hello World');
});



// Route pour l'inscription des passagers
app.post('/signup', (req, res) => {
    const { email, password, name, role } = req.body;

    if (email == null || password == null || name == null || role == null) {
        res.status(500).json({ error: "Vous devez remplir tous les champs" });
    } else {
        admin.firestore().collection("users").add({ email: email, password: password, name: name, role: role })
            .then(() => {
                res.status(200).json({ message: "Vous avez inscrit avec succès" });
            })
            .catch((err) => {
                res.status(500).json({ error: err });
            });
    }
});


//se connecter
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "L'email ou le mot de passe est vide" });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: "Le mot de passe est trop court" });
    }

    try {
        const userQuery = await admin.firestore().collection('users').where('email', '==', email).limit(1).get();

        if (userQuery.empty) {
            console.log('Utilisateur non existant.');
            return res.status(404).json({ error: "Utilisateur non existant" });
        }

        const userData = userQuery.docs[0].data();
        const storedPassword = userData.password;
        const userId = userQuery.docs[0].id; // Récupérer l'ID du document

        if (password !== storedPassword) {
            console.log('Mot de passe incorrect.');
            return res.status(401).json({ error: "Mot de passe incorrect" });
        }

        console.log('Mot de passe correct.');
        
        const token = jwt.sign({ id: userId, role: userData.role, name: userData.name }, 'azertyuop', { expiresIn: '1h' });
        return res.status(200).json({ token: token });
    } catch (error) {
        console.error('Erreur lors de l\'authentification:', error);
        return res.status(500).json({ error: 'Une erreur est survenue lors de l\'authentification' });
    }
});




// Middleware pour vérifier le rôle de l'utilisateur passager
const authorizePassenger = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).json({ error: 'Token non fourni' });
    }
    jwt.verify(token, "azertyuop", (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Token invalide' });
        }
        if (decoded.role !== 'passager') {
            return res.status(403).json({ error: 'Accès non autorisé - Vous devez être un passager'  });
        }
        console.log(decoded.role);
        res.status(200).json({ message: "Vous avez connecté avec succès" });
        next();
    });
};





// Middleware pour vérifier le rôle de l'utilisateur compagnie
const authorizeCompany = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).json({ error: 'Token non fourni' });
    }
    jwt.verify(token, "azertyuop", (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Token invalide' });
        }
        if (decoded.role !== 'compagne') {
            return res.status(403).json({ error: 'Accès non autorisé - Vous devez être un passager'  });
        }
        console.log(decoded.role);
        res.status(200).json({ message: "Vous avez connecté avec succès" });
        next();
    });
   
};





// les routes de compagne 
//add avion

app.post('/add_restaurant' , async (req, res) => {
    try {
        const {nom , adresse  , codepostal , id_restauration, nom_restauration ,photo} = req.body;

        // Ajouter le vol à la collection 'flights' dans Firestore
    await admin.firestore().collection('restaurants').add({
          nom,adresse,codepostal,id_restauration,nom_restauration ,photo

        });

        res.json({ message: 'Restaurant ajouté avec succès'});
    } catch (error) {
        console.error('Erreur lors de l\'ajout du restaurant : ', error.message);
        res.status(500).json({ error: 'Erreur lors de l\'ajout du restaurant' });
    }
});





app.get('/restaurants/:id_restauration', async (req, res) => {
    try {
        const idRestauration = req.params.id_restauration;

        // Récupérer tous les documents de la collection 'restaurants' associés à l'ID du restaurant
        const restaurantsSnapshot = await admin.firestore().collection('restaurants').where('id_restauration', '==', idRestauration).get();

        const restaurants = [];

        // Pour chaque restaurant trouvé, récupérer ses données
        restaurantsSnapshot.forEach(doc => {
            const restaurantData = doc.data();
             restaurantData.id=doc.id;
            restaurants.push(restaurantData);
        });

        res.json(restaurants);
    } catch (error) {
        console.error('Erreur lors de la récupération des restaurants du restaurant:', error.message);
        res.status(500).json({ error: 'Erreur lors de la récupération des restaurants du restaurant.' });
    }
});







app.delete('/comments/:id', async (req, res) => {
    try {
        const commentId = req.params.id;

        // Supprimer le commentaire de la collection 'comment' dans Firestore
        await admin.firestore().collection('comment').doc(commentId).delete();

        res.json({ message: 'Commentaire supprimé avec succès' });
    } catch (error) {
        console.error('Erreur lors de la suppression du commentaire : ', error.message);
        res.status(500).json({ error: 'Erreur lors de la suppression du commentaire' });
    }
});


app.get('/comments/:idRestaurant', async (req, res) => {
    try {
        const idRestaurant = req.params.idRestaurant;

        // Récupérer tous les commentaires associés à l'ID du restaurant
        const commentsSnapshot = await admin.firestore().collection('comment').where('id_restaurant', '==', idRestaurant).get();

        if (commentsSnapshot.empty) {
            return res.status(404).json({ error: 'Aucun commentaire trouvé pour ce restaurant.' });
        }

        const comments = [];
        for (const doc of commentsSnapshot.docs) {
            const commentData = doc.data();
            commentData.id = doc.id; // Ajouter l'ID du document aux données du commentaire
            comments.push(commentData);
        }

        res.json(comments);
    } catch (error) {
        console.error('Erreur lors de la récupération des commentaires du restaurant:', error.message);
        res.status(500).json({ error: 'Erreur lors de la récupération des commentaires du restaurant.' });
    }
});


app.post('/add_comment' , async (req, res) => {
    try {
        const {id_restaurant, id_user , description , nom_restaurant  ,nom_user, rating} = req.body;

        // Ajouter le commentaire à la collection 'comment' dans Firestore
        await admin.firestore().collection('comment').add({
            id_restaurant,
            id_user,
            description,
            nom_restaurant,
            nom_user,

            rating // Ajout de la propriété rating pour le nombre d'étoiles
        });

        res.json({ message: 'Commentaire ajouté avec succès'});
    } catch (error) {
        console.error('Erreur lors de l\'ajout du commentaire : ', error.message);
        res.status(500).json({ error: 'Erreur lors de l\'ajout du commentaire' });
    }
});








app.get('/restaurants', async (req, res) => {
    try {
        const restaurantsSnapshot = await admin.firestore().collection('restaurants').get();
        const restaurants = [];
        restaurantsSnapshot.forEach(doc => {
            const restaurantData = doc.data();
            restaurantData.id = doc.id; // Ajouter l'ID du document à l'objet restaurantData
            restaurants.push(restaurantData);
        });
        res.json(restaurants);
    } catch (error) {
        console.error('Erreur lors de la récupération des restaurants:', error.message);
        res.status(500).json({ error: 'Erreur lors de la récupération des restaurants.' });
    }
});







// Endpoint pour obtenir la moyenne des étoiles par restaurant
app.get('/restaurants/:id/moyenne', async (req, res) => {
    try {
        const idRestaurant = req.params.id;

        // Récupérer tous les commentaires associés à l'ID du restaurant
        const commentsSnapshot = await admin.firestore().collection('comment').where('id_restaurant', '==', idRestaurant).get();

        if (commentsSnapshot.empty) {
            return res.status(404).json({ error: 'Aucun commentaire trouvé pour ce restaurant.' });
        }

        let totalRating = 0;
        let numberOfComments = 0;

        // Calculer la somme des notations et le nombre total de commentaires
        commentsSnapshot.forEach(doc => {
            const commentData = doc.data();
            totalRating += commentData.rating;
            numberOfComments++;
        });

        // Calculer la moyenne des étoiles
        const averageRating = totalRating / numberOfComments;

        res.json({ moyenne: averageRating });
    } catch (error) {
        console.error('Erreur lors du calcul de la moyenne des étoiles:', error.message);
        res.status(500).json({ error: 'Erreur lors du calcul de la moyenne des étoiles.' });
    }
});



app.delete('/comments/:id', async (req, res) => {
    try {
        const commentId = req.params.id;

        // Supprimer le commentaire de la collection 'comment' dans Firestore
        await admin.firestore().collection('comment').doc(commentId).delete();

        res.json({ message: 'Commentaire supprimé avec succès' });
    } catch (error) {
        console.error('Erreur lors de la suppression du commentaire : ', error.message);
        res.status(500).json({ error: 'Erreur lors de la suppression du commentaire' });
    }
});


// Endpoint pour supprimer un restaurant
app.delete('/restaurants/:id', async (req, res) => {
    try {
        const restaurantId = req.params.id;

        // Supprimer le restaurant de la collection 'restaurants' dans Firestore
        await admin.firestore().collection('restaurants').doc(restaurantId).delete();

        res.json({ message: 'Restaurant supprimé avec succès' });
    } catch (error) {
        console.error('Erreur lors de la suppression du restaurant : ', error.message);
        res.status(500).json({ error: 'Erreur lors de la suppression du restaurant' });
    }
});







app.post('/comments/:commentId/replies', async (req, res) => {
    try {
        const { commentId } = req.params;
        const { userId, description } = req.body;

        // Vérifier si le commentaire parent existe
        const commentSnapshot = await admin.firestore().collection('comment').doc(commentId).get();
        if (!commentSnapshot.exists) {
            return res.status(404).json({ error: 'Le commentaire parent n\'existe pas' });
        }

        // Ajouter la réponse à la base de données
        const replyRef = await admin.firestore().collection('replies').add({
            commentId: commentId,
            userId: userId,
            description: description
        });

        return res.status(201).json({ message: 'Réponse ajoutée avec succès', replyId: replyRef.id });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la réponse:', error);
        return res.status(500).json({ error: 'Une erreur est survenue lors de l\'ajout de la réponse' });
    }
});








app.post('/comments/:commentId/replies', async (req, res) => {
    try {
        const { id_restauration, id_commentaire, nom_restauration, description } = req.body;

        // Ajouter la réponse à la collection 'replies' dans Firestore
        await admin.firestore().collection('replies').add({
            id_restauration,
            id_commentaire,
            nom_restauration,
            description
        });

        res.json({ message: 'Réponse ajoutée avec succès'});
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la réponse : ', error.message);
        res.status(500).json({ error: 'Erreur lors de l\'ajout de la réponse' });
    }
});


// Endpoint pour récupérer toutes les réponses d'un commentaire
app.get('/comments/:commentId/replies', async (req, res) => {
    try {
        const commentId = req.params.commentId;

        // Récupérer toutes les réponses associées à l'ID du commentaire
        const repliesSnapshot = await admin.firestore().collection('replies').where('commentId', '==', commentId).get();

        if (repliesSnapshot.empty) {
            return res.status(404).json({ error: 'Aucune réponse trouvée pour ce commentaire.' });
        }

        const replies = [];
        repliesSnapshot.forEach(doc => {
            const replyData = doc.data();
            replyData.id = doc.id; // Ajouter l'ID du document à l'objet replyData
            replies.push(replyData);
        });

        res.json(replies);
    } catch (error) {
        console.error('Erreur lors de la récupération des réponses du commentaire:', error.message);
        res.status(500).json({ error: 'Erreur lors de la récupération des réponses du commentaire.' });
    }
});













app.listen(process.env.PORT , () => {
    console.log(`Server is listening at http://localhost:${port}`);
});
