// ********************** Initialize server **********************************

const server = require('../index'); //TODO: Make sure the path to your index.js is correctly added

// ********************** Import Libraries ***********************************

const chai = require('chai'); // Chai HTTP provides an interface for live integration testing of the API's.
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const {assert, expect} = chai;

// ********************** DEFAULT WELCOME TESTCASE ****************************

describe('Server!', () => {
  // Sample test case given to test / endpoint.
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });
});

// *********************** TODO: WRITE 2 UNIT TESTCASES **************************

//Postitive /register test
describe('POST /register Positive Case', () => {
  it('This test case should pass and return a status 200 along with a Success message.', done => {
    chai
      .request(server)
      .post('/register')
      .send({ username: 'testuser', password: 'testpass' })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.message).to.equal('Registration successful');
        done();
      });
  });
});

//Negative /register unit test
describe('POST /register (Negative Case)', () => {
    it('should return 400 when required fields are missing', done => {
      chai
        .request(server)
        .post('/register')
        .send({ username: 'incompleteUser' }) 
        .end((err, res) => {
          expect(res).to.have.status(400); 
          expect(res.body).to.have.property('error');
          done();
        });
    });
  });

// *******************************************************************************

// ************ TODO: WRITE Additional 2 UNIT TESTCASES (Part C) *****************

// *******************************************************************************

//Positive /login unit test
describe('POST /login (positive Case)', () => {
  it('returns 200 when login information is valid', done => {
    chai
      .request(server)
      .post('/login')
      .send({ username: 'johndoe', password: 'pass123' })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.message).to.equal('Login successful');
        done();
      });
  });
});


//Negative /login unit test
describe('POST /login (Negative Case)', () => {

  it('should return 400 when required fields are missing', (done) => {
    chai
      .request(server)
      .post('/login')
      .send({ password: 'testpassword' })  // Missing username
      .end((err, res) => {
        expect(res).to.have.status(400);  // Expect 400 status
        expect(res.body.error).to.equal('Username and password are required.');
        done();
      });
  });

});
