module RedmineKanban
  class BoardListsBuilder
    # Formatos con un conjunto de valores ENUMERABLE: son los unicos con los que
    # se puede construir la lista de carriles de antemano. Un 'date' o un 'int'
    # darian un carril por valor distinto, sin cota. Ampliar aqui si hace falta.
    LANEABLE_CF_FORMATS = %w[list bool].freeze
    def initialize(project:, project_ids:, user:)
      @project = project
      @project_ids = project_ids
      @user = user
    end

    def build
      {
        assignees: assignees_list,
        trackers: trackers_list,
        priorities: priorities_list,
        categories: categories_list,
        custom_field_lanes: custom_field_lanes_list,
        projects: projects_list,
        viewable_projects: viewable_projects_list,
        creatable_projects: creatable_projects_list,
      }
    end

    private

    def projects_list
      project_catalog.subtree_projects(root: @project)
    end

    def viewable_projects_list
      project_catalog.viewable_projects
    end

    def creatable_projects_list
      project_catalog.creatable_projects
    end

    def assignees_list
      projects = Project.where(id: @project_ids).to_a
      users = projects.map(&:assignable_users).flatten.uniq.sort_by { |user| user.name.to_s.downcase }
      [{ id: nil, name: ::I18n.t("redmine_kanban.label_unassigned") }] + users.map { |user| { id: user.id, name: user.name } }
    end

    def trackers_list
      project_ids = @project_ids | project_catalog.subtree_projects(root: @project).map { |project| project[:id] }
      projects = Project.visible(@user).where(id: project_ids).includes(:trackers).to_a.select(&:active?)
      trackers = projects.flat_map(&:trackers).uniq.sort_by(&:position)
      available_project_ids_by_tracker = Hash.new { |hash, key| hash[key] = [] }
      projects.each do |project|
        project.trackers.each { |tracker| available_project_ids_by_tracker[tracker.id] << project.id }
      end

      TrackerMetadataBuilder.new(
        trackers: trackers,
        available_project_ids_by_tracker: available_project_ids_by_tracker,
      ).build
    end

    def priorities_list
      IssuePriority.active.sorted.to_a.map { |priority| { id: priority.id, name: priority.name } }
    end

    def categories_list
      IssueCategory.where(project_id: @project_ids)
                   .sort_by { |category| [category.name.to_s.downcase, category.project_id] }
                   .map { |category| { id: category.id, name: category.name, project_id: category.project_id } }
    end

    # Criterio de agrupabilidad: el de Redmine, no uno propio. `group_statement`
    # es lo que decide si una columna aparece en su "Agrupar por", asi que un
    # campo agrupable en la lista de peticiones lo es tambien aqui.
    def laneable_custom_fields
      Project.where(id: @project_ids)
             .to_a
             .flat_map { |project| project.all_issue_custom_fields.to_a }
             .uniq
             .select do |cf|
               !cf.multiple? &&
                 LANEABLE_CF_FORMATS.include?(cf.field_format) &&
                 cf.group_statement.present? &&
                 cf.visible?
             end
             .sort_by { |cf| cf.name.to_s.downcase }
    end

    def custom_field_lanes_list
      laneable_custom_fields.map do |cf|
        {
          id: "cf_#{cf.id}",
          cf_id: cf.id,
          name: cf.name,
          field_format: cf.field_format,
          possible_values: lane_values_for(cf)
        }
      end
    end

    def lane_values_for(cf)
      case cf.field_format
      when 'bool'
        # Redmine guarda los booleanos como '1'/'0' en custom_values.value.
        [{ value: '1', name: ::I18n.t(:general_text_Yes) },
         { value: '0', name: ::I18n.t(:general_text_No) }]
      else
        Array(cf.possible_values).map { |v| { value: v, name: v } }
      end
    end

    def project_catalog
      @project_catalog ||= ProjectCatalog.new(user: @user, board_project: @project)
    end
  end
end
