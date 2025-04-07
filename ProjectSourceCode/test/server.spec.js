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


//Positive /login test
describe('Testing login API', () => {
  let agent;
  const testUser = {
    username: 'testuser',
    password: 'testpass123',
  };

  before(async () => {
    // Clear users table and create test user
    await db.query('TRUNCATE TABLE users CASCADE');
    const hashedPassword = await bcryptjs.hash(testUser.password, 10);
    await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', [
      testUser.username,
      hashedPassword,
    ]);
  });

  beforeEach(() => {
    // Create new agent for session handling
    agent = chai.request.agent(app);
  });

  afterEach(() => {
    // Clear cookie after each test
    agent.close();
  });

  after(async () => {
    // Clean up database
    await db.query('TRUNCATE TABLE users CASCADE');
  });

  describe('GET /profile after logging in', () => {
    it('should return 401 if user is not authenticated', done => {
      chai
        .request(app)
        .get('/profile')
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.text).to.equal('Not authenticated');
          done();
        });
    });

    it('should return user profile when authenticated', async () => {
      // First login to get session
      await agent.post('/login').send(testUser);

      // Then access profile
      const res = await agent.get('/profile');

      expect(res).to.have.status(200);
      expect(res.body).to.be.an('object');
      expect(res.body).to.have.property('username', testUser.username);
    });
  });
});

// ********************************************************************************