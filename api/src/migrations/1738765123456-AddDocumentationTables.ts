import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocumentationTables1738765123456 implements MigrationInterface {
  name = 'AddDocumentationTables1738765123456';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extension UUID si pas déjà présente
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Table des catégories de documentation
    await queryRunner.query(`
      CREATE TABLE "doc_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "slug" character varying(255) NOT NULL,
        "description" text,
        "icon" character varying(100) NOT NULL DEFAULT 'BookOpen',
        "color" character varying(7) NOT NULL DEFAULT '#3B82F6',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_doc_categories_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_doc_categories" PRIMARY KEY ("id")
      )
    `);

    // Table des pages de documentation
    await queryRunner.query(`
      CREATE TABLE "doc_pages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "categoryId" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "slug" character varying(255) NOT NULL,
        "content" text NOT NULL,
        "contentType" character varying(20) NOT NULL DEFAULT 'markdown',
        "metaDescription" text,
        "metaKeywords" text,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "isPublished" boolean NOT NULL DEFAULT false,
        "viewCount" integer NOT NULL DEFAULT 0,
        "createdBy" uuid,
        "updatedBy" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_doc_pages_category_slug" UNIQUE ("categoryId", "slug"),
        CONSTRAINT "PK_doc_pages" PRIMARY KEY ("id")
      )
    `);

    // Table des versions de pages
    await queryRunner.query(`
      CREATE TABLE "doc_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "pageId" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "content" text NOT NULL,
        "versionNumber" integer NOT NULL,
        "changeSummary" text,
        "createdBy" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_doc_versions" PRIMARY KEY ("id")
      )
    `);

    // Table des attachments/médias
    await queryRunner.query(`
      CREATE TABLE "doc_attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "pageId" uuid NOT NULL,
        "filename" character varying(255) NOT NULL,
        "originalName" character varying(255) NOT NULL,
        "mimeType" character varying(100),
        "size" integer,
        "path" character varying(500) NOT NULL,
        "createdBy" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_doc_attachments" PRIMARY KEY ("id")
      )
    `);

    // Index pour les performances
    await queryRunner.query(
      `CREATE INDEX "IDX_doc_pages_category_published" ON "doc_pages" ("categoryId", "isPublished")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_doc_pages_slug" ON "doc_pages" ("slug")`);
    await queryRunner.query(`CREATE INDEX "IDX_doc_categories_slug" ON "doc_categories" ("slug")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_doc_versions_page_version" ON "doc_versions" ("pageId", "versionNumber")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_doc_attachments_page" ON "doc_attachments" ("pageId")`,
    );

    // Clés étrangères
    await queryRunner.query(`
      ALTER TABLE "doc_pages" 
      ADD CONSTRAINT "FK_doc_pages_category" 
      FOREIGN KEY ("categoryId") REFERENCES "doc_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "doc_pages" 
      ADD CONSTRAINT "FK_doc_pages_creator" 
      FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "doc_pages" 
      ADD CONSTRAINT "FK_doc_pages_updater" 
      FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "doc_versions" 
      ADD CONSTRAINT "FK_doc_versions_page" 
      FOREIGN KEY ("pageId") REFERENCES "doc_pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "doc_versions" 
      ADD CONSTRAINT "FK_doc_versions_creator" 
      FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "doc_attachments" 
      ADD CONSTRAINT "FK_doc_attachments_page" 
      FOREIGN KEY ("pageId") REFERENCES "doc_pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "doc_attachments" 
      ADD CONSTRAINT "FK_doc_attachments_creator" 
      FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // Trigger pour mettre à jour updated_at automatiquement
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updatedAt = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_doc_categories_updated_at 
      BEFORE UPDATE ON "doc_categories"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_doc_pages_updated_at 
      BEFORE UPDATE ON "doc_pages"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    // Trigger pour créer automatiquement une version lors de la modification d'une page
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION create_doc_version()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Créer une version seulement si le contenu a changé
        IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN
          INSERT INTO doc_versions ("pageId", title, content, "versionNumber", "createdBy")
          VALUES (
            NEW.id,
            NEW.title,
            NEW.content,
            COALESCE((SELECT MAX("versionNumber") FROM doc_versions WHERE "pageId" = NEW.id), 0) + 1,
            NEW."updatedBy"
          );
        END IF;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await queryRunner.query(`
      CREATE TRIGGER create_doc_version_trigger 
      AFTER UPDATE ON "doc_pages"
      FOR EACH ROW EXECUTE FUNCTION create_doc_version();
    `);

    // Fonction pour la recherche full-text
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION search_docs(search_term TEXT)
      RETURNS TABLE (
        "pageId" uuid,
        "categoryName" character varying(255),
        title character varying(255),
        slug character varying(255),
        "contentPreview" text,
        rank real
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          p.id,
          c.name,
          p.title,
          p.slug,
          LEFT(p.content, 200) || '...' as "contentPreview",
          ts_rank(to_tsvector('french', p.title || ' ' || p.content), plainto_tsquery('french', search_term)) as rank
        FROM doc_pages p
        JOIN doc_categories c ON p."categoryId" = c.id
        WHERE 
          p."isPublished" = true
          AND (
            to_tsvector('french', p.title || ' ' || p.content) @@ plainto_tsquery('french', search_term)
            OR p.title ILIKE '%' || search_term || '%'
          )
        ORDER BY rank DESC, p.title ASC;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Données initiales pour les catégories
    await queryRunner.query(`
      INSERT INTO "doc_categories" (name, slug, description, icon, color, "sortOrder") VALUES
      ('Guide de démarrage', 'guide-demarrage', 'Tout ce qu''il faut savoir pour débuter avec Flowly', 'Rocket', '#10B981', 1),
      ('Flowly API', 'flowly-api', 'Documentation technique de l''API backend NestJS', 'Server', '#3B82F6', 2),
      ('Flowly Dashboard', 'flowly-dashboard', 'Documentation de l''interface utilisateur Next.js', 'Layout', '#8B5CF6', 3),
      ('Flowly Plugin', 'flowly-plugin', 'Documentation du plugin React pour BigBlueButton', 'Puzzle', '#F59E0B', 4),
      ('Déploiement', 'deploiement', 'Guide de déploiement et configuration', 'Cloud', '#EF4444', 5);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Supprimer les triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS create_doc_version_trigger ON "doc_pages"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_doc_pages_updated_at ON "doc_pages"`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_doc_categories_updated_at ON "doc_categories"`,
    );

    // Supprimer les fonctions
    await queryRunner.query(`DROP FUNCTION IF EXISTS create_doc_version()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS search_docs(TEXT)`);

    // Supprimer les clés étrangères
    await queryRunner.query(
      `ALTER TABLE "doc_attachments" DROP CONSTRAINT "FK_doc_attachments_creator"`,
    );
    await queryRunner.query(
      `ALTER TABLE "doc_attachments" DROP CONSTRAINT "FK_doc_attachments_page"`,
    );
    await queryRunner.query(`ALTER TABLE "doc_versions" DROP CONSTRAINT "FK_doc_versions_creator"`);
    await queryRunner.query(`ALTER TABLE "doc_versions" DROP CONSTRAINT "FK_doc_versions_page"`);
    await queryRunner.query(`ALTER TABLE "doc_pages" DROP CONSTRAINT "FK_doc_pages_updater"`);
    await queryRunner.query(`ALTER TABLE "doc_pages" DROP CONSTRAINT "FK_doc_pages_creator"`);
    await queryRunner.query(`ALTER TABLE "doc_pages" DROP CONSTRAINT "FK_doc_pages_category"`);

    // Supprimer les index
    await queryRunner.query(`DROP INDEX "IDX_doc_attachments_page"`);
    await queryRunner.query(`DROP INDEX "IDX_doc_versions_page_version"`);
    await queryRunner.query(`DROP INDEX "IDX_doc_categories_slug"`);
    await queryRunner.query(`DROP INDEX "IDX_doc_pages_slug"`);
    await queryRunner.query(`DROP INDEX "IDX_doc_pages_category_published"`);

    // Supprimer les tables
    await queryRunner.query(`DROP TABLE "doc_attachments"`);
    await queryRunner.query(`DROP TABLE "doc_versions"`);
    await queryRunner.query(`DROP TABLE "doc_pages"`);
    await queryRunner.query(`DROP TABLE "doc_categories"`);
  }
}
