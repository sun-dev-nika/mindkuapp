/**
 * Definición del schema GraphQL: mismo dominio de notas que expone
 * `routes/notes.ts` por REST, sin campos ni operaciones nuevas — `notes` /
 * `note(id)` equivalen a `GET /notes` / `GET /notes/:id`, y las tres
 * mutations equivalen a `POST` / `PUT` / `DELETE /notes/:id`.
 */
export const typeDefs = `#graphql
  type Note {
    id: ID!
    title: String!
    body: String
    createdAt: String!
    updatedAt: String!
  }

  input CreateNoteInput {
    title: String!
    body: String
  }

  input UpdateNoteInput {
    title: String
    body: String
  }

  type Query {
    notes: [Note!]!
    note(id: ID!): Note
  }

  type Mutation {
    createNote(input: CreateNoteInput!): Note!
    updateNote(id: ID!, input: UpdateNoteInput!): Note!
    deleteNote(id: ID!): Boolean!
  }
`;
