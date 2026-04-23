const typeDefs = `
  type Post {
    _id: ID!
    title: String!
    content: String!
    imageUrl: String!
    creator: User!
    createdAt: String!
    updatedAt: String!
  }

  type User {
    _id: ID!
    email: String!
    name: String!
    password: String
    status: String!
    posts: [Post!]!
  }

  type AuthData {
    userId: ID!
    email: String!
    token: String!
  }
    type PostData {
    posts: [Post!]!
    totalPosts: Int!
    }

  input UserInputData {
    email: String!
    name: String!
    password: String!
  }
  input PostInputData {
    title: String!
    content: String!
    imageUrl: String!
}

  type Query {
    hello: String!
    posts(page: Int, perPage: Int): PostData!
    post(id: ID!): Post! 
    }
    
   type Mutation {
  login(email: String!, password: String!): AuthData!
  createUser(userInput: UserInputData): User!
  createPost(postInput: PostInputData): Post!
  updatePost(id: ID!, postInput: PostInputData): Post!
  deletePost(id: ID!): Boolean!
}
  
  
`

module.exports = typeDefs