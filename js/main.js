;(function(window, _, $, Backbone, undefined){

	window.App = {
		Models: {},
		Collections: {},
		Views: {},
		Router: {},
		Helpers: {}
	};

	App.getTemplate = function( id ) {
		return _.template( $( '#' + id ).html() );
	};

	App.vent = _.extend({}, Backbone.Events);

	App.Helpers.parseWord = function( word, show ){
		var i,
			word_array = []
		;
		
		show = ( _.isUndefined(show) ) ? false : true;

		for( i = 0; i < word.length; i++)
		{
			word_array.push({
				value: word[i],
				show: show
			});
		}

		return word_array;
	};

	App.Models.Player = Backbone.Model.extend({
		defaults: {
			name: 'Player',
			score: 0,
			status: 'not playing'
		},

		initialize: function(){
			App.vent.on('player.update', this.update, this);
			App.vent.on('player.win', this.win, this);
			App.vent.on('player.lose', this.lose, this);
		},

		update: function( args ){
			if (_(args).has('name')){
				this.set('name', args.name);
			}
			if (_(args).has('score')){
				this.set('score', args.score);
			}
			if (_(args).has('status')){
				this.set('status', args.status);
			}
		},

		win: function(){
			this.set('score', this.get('score') + 1);
			this.set('status', 'winner');
		},

		lose: function(){
			this.set('status', 'loser');
		}
	});

	App.Views.Player = Backbone.View.extend({

		tagName: 'ul',

		initialize: function() {
			this.model.on('change', this.render, this);
		},

		template : App.getTemplate( 'player-template' ),

		render: function(){

			this.$el.html( this.template( this.model.toJSON() ) );
			return this;
		}
	});

	App.Models.Game = Backbone.Model.extend({

		defaults: {
			max_tries: 7,
			active: false,
			correct_guesses: 0,
			incorrect_guesses: 0,
			words: ['COMPUTER','PIANO'] 
		},

		initialize: function(){
			App.vent.on('game.guess', this.guess, this);
			App.vent.on('game.over', this.complete, this);
			App.vent.on('game.incorrect', this.incorrect, this);
			App.vent.on('game.correct', this.correct, this);
			App.vent.on('game.start', this.start, this);
		},

		start: function(){
			this.set('active', true);
			App.vent.trigger('player.update', {status: 'playing'});
			App.vent.trigger('game.toggle');
		},

		guess: function( letter ){
			if(this.get('active')){
				App.vent.trigger('word.check', letter);
			} else {
				App.vent.trigger('game.alert', { message: 'Please start game to play.'});
			}
		},

		incorrect: function(){
			
			App.vent.trigger('guesses.add', {
				value: letter,
				show: true
			});

			this.set('incorrect_guesses', this.get('incorrect_guesses')+1);

			if (this.get('incorrect_guesses') >= this.get('max_tries')){
				this.complete({
					status: 'lost'
				});
			}
		},

		correct: function(){
			this.set('correct_guesses', this.get('correct_guesses') + 1);
			App.vent.trigger('word.checkForWin');
		},

		complete: function( args ){
			this.set('status', args.status);
			switch( this.get('status') ){
				case 'won': 
					App.vent.trigger('player.win');
					break;
				case 'lost': 
					App.vent.trigger('player.lose');
					break;
				case 'killed':
					App.vent.trigger('player.update', {status: 'not playing'});
			}
			this.reset();
		},

		getNextWord: function(){
			var index = Math.floor(Math.random() * this.get('words').length),
				words = this.get('words');
			return words[index];
		},

		reset: function(){
			var word;
			this.set('incorrect_guesses', 0);
			this.set('correct_guesses', 0);
			this.set('active', false);
			word = this.getNextWord();
			App.vent.trigger('word.new', App.Helpers.parseWord(word));
			App.vent.trigger('guesses.reset');
			App.vent.trigger('game.toggle');
		}

	});

	App.Views.Game = Backbone.View.extend({

		el: '#game',

		initialize: function(){
			App.vent.on('game.toggle', this.toggle, this);
			App.vent.on('game.alert', this.alert, this);
		},

		events: {
			'click #start': 'start',
			'click #end': 'end'
		},

		toggle: function(){
			$('#start').toggle();
			$('#end').toggle();
			$('.disabled-overlay').toggle();
		},

		alert: function( args ){
			alert(args.message);
		},

		start: function(){
			App.vent.trigger('game.start');
		},

		end: function(){
			App.vent.trigger('game.over', {status: 'killed'});
		}

	});

	App.Models.HangmanSegment = Backbone.Model.extend({
		defaults : {
			type: 'head'
		}
	});

	App.Models.Letter = Backbone.Model.extend({

		defaults: {
			value: 'A',
			show: false
		}

	});

	App.Views.Letter = Backbone.View.extend({

		tagName: 'li',
		template: App.getTemplate('letter-template'),

		initialize: function(){
			this.model.on('change', this.render, this);
		},

		render: function(){
			var value =  (this.model.get('show')) ? this.template( this.model.toJSON() ) : '_';
			this.$el.html( value );
			return this;
		}

	});

	App.Collections.Letters = Backbone.Collection.extend({
		model: App.Models.Letter,
	});

	App.Collections.Guesses = App.Collections.Letters.extend({
		initialize: function(){
			App.vent.on('guesses.add', this.add, this);
			App.vent.on('guesses.reset', this.reset, this);
		}
	})

	App.Collections.Word = App.Collections.Letters.extend({

		initialize: function(){
			App.vent.on('word.check', this.checkLetter, this);
			App.vent.on('word.checkForWin', this.checkForWin, this);
			App.vent.on('word.new', this.newWord, this);
		},

		checkForWin: function(){
			var win = this.every( function(l){
				return l.get('show');
			});

			if (win) {
				App.vent.trigger('game.over', {
					status: 'won'
				});
			}
		},

		checkLetter: function( letter ){
			var correct = false;

			this.each( function(l){
				if ( l.get('value') === letter ){
					correct = true;
					l.set('show', true);
				}
			});

			if (correct){
				App.vent.trigger('game.correct');
			} else {
				App.vent.trigger('game.incorrect', letter );
			}
		},

		newWord: function( letters ){
			this.reset(letters);
		}

	});

	App.Views.Letters = Backbone.View.extend({

		tagName: 'ul',

		initialize: function(){
			this.collection.on('add', this.addNew, this);
			this.collection.on('reset', this.render, this);
		},

		addNew: function( letter ){

			var letterView = new App.Views.Letter({ model: letter });
			this.$el.append( letterView.render().el );
		},

		render: function(){
			this.$el.html('');
			this.collection.each( function( letter ) {
				this.addNew(letter);
			}, this);
			return this;
		}

	});

	App.Views.GuessForm = Backbone.View.extend({
		el: '#guess-form',

		events: {
			submit: 'submit'
		},

		submit: function( e ){
			e.preventDefault();
			letter = $('#guess-textbox').val().trim().toUpperCase();
			if (letter) {
				App.vent.trigger('game.guess', letter);
				$('#guess-textbox').val('');
			}
		},

	});

	var game = new App.Models.Game({ words: [

		'ANGULAR',
		'BACKBONE',
		'JQUERY',
		'UNDERSCORE',
		'LARAVEL',
		'CODEIGNITER',
		'SYMFONY',
		'TABLE',
		'PLASTIC',
		'STEREO',
		'AUTOMOBILE',
		'COUCH',
		'COMPUTER',
		'PIANO',
		'GLASS',
		'TOWEL',
		'MONITOR'

		] });
	var gameView = new App.Views.Game({model: game});

	var player = new App.Models.Player({ name: 'Hangman' });
	var playerView = new App.Views.Player({ model: player });
	$('#player-bar').html( playerView.render().el );

	var word = new App.Collections.Word( App.Helpers.parseWord('CAT') );
	var wordView = new App.Views.Letters({ collection: word });
	$('#wordboard').html( wordView.render().el );

	var guess = new App.Collections.Guesses();
	var guessView = new App.Views.Letters({ collection: guess });
	$('#guessed-letters').html( guessView.render().el );

	var guessFormView = new App.Views.GuessForm();

})(window, _.noConflict(), jQuery, Backbone);